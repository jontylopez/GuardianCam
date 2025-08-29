import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import { setWasmPaths as setTfjsWasmPaths } from '@tensorflow/tfjs-backend-wasm';
// Use the bundled ESM build to avoid missing internal files in some bundlers
import * as tflite from '@tensorflow/tfjs-tflite/dist/tf-tflite.es2017.js';

export function useAudioFallDetector(options) {
  const hopSeconds = options?.hopSeconds ?? 0.5;
  const inputGainDb = options?.gainDb ?? 0; // simple amplitude boost if needed
  const applySigmoidStrategy = options?.applySigmoid ?? 'auto'; // 'auto' | true | false

  const [state, setState] = useState({
    helpProb: 0,
    impactProb: 0,
    help: false,
    impact: false,
    running: false,
    lastUpdatedAt: null,
    rms: 0,
  });

  const modelRef = useRef(null);
  const thresholdsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const scriptNodeRef = useRef(null);
  const ringBufferRef = useRef(new Float32Array(32000));
  const ringWriteIndexRef = useRef(0);
  const hopTimerRef = useRef(null);
  const consecutivePositiveRef = useRef(0);
  const latestRmsRef = useRef(0);
  const zerosStreakRef = useRef(0);
  const switchedToFloatRef = useRef(false);

  const ensureBackendsAndModel = useCallback(async () => {
    if (modelRef.current && thresholdsRef.current) return;

    // Ensure TFJS WASM backend finds its binaries
    try {
      setTfjsWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.17.0/dist/');
    } catch (_) {}
    await tf.setBackend('wasm');
    await tf.ready();

    // Point tfjs-tflite to a CDN for its wasm files
    try {
      tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.10/dist/');
    } catch (_) {}

    if (!thresholdsRef.current) {
      const resp = await fetch('/models/audio_thresholds.json');
      if (!resp.ok) throw new Error('Failed to load /models/audio_thresholds.json');
      const json = await resp.json();
      thresholdsRef.current = json; // expects keys: help, impact, sr, window_samples
    }

    if (!modelRef.current) {
      const preferFloat = options?.forceFloatModel === true;
      if (!preferFloat) {
        try {
          modelRef.current = await tflite.loadTFLiteModel('/models/audio_fall_multitask_int8.tflite');
        } catch (err) {
          console.warn('Failed to load int8 model; falling back to float model', err);
          modelRef.current = await tflite.loadTFLiteModel('/models/audio_fall_multitask.tflite');
          switchedToFloatRef.current = true;
        }
      } else {
        modelRef.current = await tflite.loadTFLiteModel('/models/audio_fall_multitask.tflite');
        switchedToFloatRef.current = true;
      }
    }
  }, [options?.forceFloatModel]);

  const stop = useCallback(async () => {
    if (hopTimerRef.current) {
      window.clearInterval(hopTimerRef.current);
      hopTimerRef.current = null;
    }

    const scriptNode = scriptNodeRef.current;
    if (scriptNode && scriptNode.disconnect) {
      try { scriptNode.disconnect(); } catch (_) {}
    }
    scriptNodeRef.current = null;

    const mediaSource = mediaSourceRef.current;
    if (mediaSource) {
      try { mediaSource.disconnect(); } catch (_) {}
    }
    mediaSourceRef.current = null;

    const mediaStream = mediaStreamRef.current;
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
    }
    mediaStreamRef.current = null;

    const audioContext = audioContextRef.current;
    if (audioContext) {
      try { await audioContext.close(); } catch (_) {}
    }
    audioContextRef.current = null;

    setState(prev => ({ ...prev, running: false }));
  }, []);

  function pushToRingBuffer(input) {
    const ring = ringBufferRef.current;
    const size = ring.length;
    let writeIndex = ringWriteIndexRef.current;
    for (let i = 0; i < input.length; i++) {
      ring[writeIndex] = input[i];
      writeIndex++;
      if (writeIndex >= size) writeIndex = 0;
    }
    ringWriteIndexRef.current = writeIndex;
  }

  function readRingBufferWindow() {
    const ring = ringBufferRef.current;
    const size = ring.length;
    const writeIndex = ringWriteIndexRef.current;
    const out = new Float32Array(size);
    const tail = size - writeIndex;
    out.set(ring.subarray(writeIndex), 0);
    out.set(ring.subarray(0, writeIndex), tail);
    return out;
  }

  function dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  function downsampleTo16k(input, inSampleRate) {
    const targetRate = 16000;
    if (inSampleRate === targetRate) return input;
    const ratio = inSampleRate / targetRate;
    const newLength = Math.floor(input.length / ratio);
    const output = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const idx = i * ratio;
      const idx0 = Math.floor(idx);
      const idx1 = Math.min(idx0 + 1, input.length - 1);
      const frac = idx - idx0;
      output[i] = input[idx0] * (1 - frac) + input[idx1] * frac;
    }
    return output;
  }

  const start = useCallback(async () => {
    await ensureBackendsAndModel();

    // Mic
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    mediaStreamRef.current = stream;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    mediaSourceRef.current = source;

    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    scriptNodeRef.current = processor;
    source.connect(processor);
    // Keep node alive but mute to avoid feedback
    const zeroGain = audioContext.createGain();
    zeroGain.gain.value = 0;
    processor.connect(zeroGain);
    zeroGain.connect(audioContext.destination);

    // Ensure audio context is running after user gesture
    try { await audioContext.resume(); } catch (_) {}

    processor.onaudioprocess = (e) => {
      const inBuf = e.inputBuffer.getChannelData(0);
      // Compute simple RMS level for UI
      let sumSq = 0;
      for (let i = 0; i < inBuf.length; i++) { const v = inBuf[i]; sumSq += v * v; }
      const rms = Math.sqrt(sumSq / Math.max(1, inBuf.length));
      latestRmsRef.current = rms;
      let resampled = downsampleTo16k(inBuf, audioContext.sampleRate);
      // Apply simple gain if requested
      if (inputGainDb !== 0) {
        const g = dbToLinear(inputGainDb);
        for (let i = 0; i < resampled.length; i++) {
          let v = resampled[i] * g;
          if (v > 1) v = 1; else if (v < -1) v = -1;
          resampled[i] = v;
        }
      }
      if (resampled.length >= 32000) {
        pushToRingBuffer(resampled.subarray(resampled.length - 32000));
      } else {
        pushToRingBuffer(resampled);
      }
    };

    const hopMs = Math.floor(hopSeconds * 1000);
    if (hopTimerRef.current) window.clearInterval(hopTimerRef.current);
    hopTimerRef.current = window.setInterval(async () => {
      if (!modelRef.current || !thresholdsRef.current) return;
      const windowData = readRingBufferWindow(); // 32000 samples

      const inputTensor = tf.tensor(windowData, [1, 32000], 'float32');
      let output = null;
      try {
        output = modelRef.current.predict(inputTensor);
        const outTensor = Array.isArray(output) ? output[0] : output;
        const outData = await outTensor.data();
        let raw0 = Number(outData[0]);
        let raw1 = Number(outData[1]);

        // Optionally apply sigmoid if outputs look like logits
        const needSigmoid = applySigmoidStrategy === true || (
          applySigmoidStrategy === 'auto' && (
            raw0 < 0 || raw0 > 1 || raw1 < 0 || raw1 > 1
          )
        );
        if (needSigmoid) {
          const sigmoid = (x) => 1 / (1 + Math.exp(-x));
          raw0 = sigmoid(raw0);
          raw1 = sigmoid(raw1);
        }

        const helpProb = raw0;
        const impactProb = raw1;
        const help = helpProb >= Number(thresholdsRef.current.help);
        const impact = impactProb >= Number(thresholdsRef.current.impact);

        const now = Date.now();
        setState({ helpProb, impactProb, help, impact, running: true, lastUpdatedAt: now, rms: latestRmsRef.current });

        const positive = help || impact;
        if (positive) consecutivePositiveRef.current += 1; else consecutivePositiveRef.current = 0;
        if (consecutivePositiveRef.current >= 2 && options?.onEvent) {
          options.onEvent({ help, impact, helpProb, impactProb, consecutiveCount: consecutivePositiveRef.current, at: now });
        }

        // Recovery: if outputs are consistently ~0, try switching to float model once
        if (!positive && helpProb === 0 && impactProb === 0) {
          zerosStreakRef.current += 1;
          if (zerosStreakRef.current >= 6 && !switchedToFloatRef.current) {
            try {
              // eslint-disable-next-line no-console
              console.warn('Outputs constant zero. Reloading float model as recovery.');
              modelRef.current = await tflite.loadTFLiteModel('/models/audio_fall_multitask.tflite');
              switchedToFloatRef.current = true;
              zerosStreakRef.current = 0;
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error('Failed to switch to float model', e);
            }
          }
        } else {
          zerosStreakRef.current = 0;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Audio fall inference error', err);
      } finally {
        try {
          if (Array.isArray(output)) output.forEach(t => t && t.dispose && t.dispose());
          else if (output && output.dispose) output.dispose();
        } catch (_) {}
        tf.dispose(inputTensor);
      }
    }, hopMs);

    setState(prev => ({ ...prev, running: true }));
  }, [ensureBackendsAndModel, hopSeconds, inputGainDb, applySigmoidStrategy, options]);

  useEffect(() => () => { stop(); }, [stop]);

  return useMemo(() => ({ start, stop, state }), [start, stop, state]);
}


