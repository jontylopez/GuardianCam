import * as tf from '@tensorflow/tfjs';

async function ensureTflite() {
  if (typeof window !== 'undefined' && window.tflite) return window.tflite;
  // Load from CDN once
  await new Promise((resolve, reject) => {
    const id = 'tfjs-tflite-cdn';
    if (document.getElementById(id)) {
      // already loading; wait a tick
      setTimeout(resolve, 50);
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/tf-tflite.min.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load tfjs-tflite from CDN'));
    document.head.appendChild(script);
  });
  if (!window.tflite) throw new Error('tfjs-tflite not available after load');
  try {
    // Prefer CDN for WASM assets
    window.tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/');
  } catch (_) {}
  return window.tflite;
}

/**
 * Lightweight wrapper around tfjs-tflite for fall classification.
 * Chooses INT8 model if available, with float fallback.
 */
export class FallTFLiteRunner {
  constructor() {
    this.model = null;
    this.inputSize = 224;
    this.normalize01 = false; // default aligns with original hook
    this._wasmConfigured = false;
  }

  async _ensureWasmConfigured() {
    if (this._wasmConfigured) return;
    const tflite = await ensureTflite();
    try {
      tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/');
    } catch (_) {}
    this._wasmConfigured = true;
  }

  async load(preferredUrl = '/image_model/fall_cls.tflite', fallbackUrl = '/image_model/fall_cls_int8.tflite') {
    await this._ensureWasmConfigured();
    const tflite = await ensureTflite();
    try {
      this.model = await tflite.loadTFLiteModel(preferredUrl);
      return true;
    } catch (e1) {
      try {
        this.model = await tflite.loadTFLiteModel(fallbackUrl);
        return true;
      } catch (e2) {
        console.error('Failed loading TFLite models', e1, e2);
        this.model = null;
        return false;
      }
    }
  }

  /**
   * Run inference on an ImageData or HTMLCanvasElement/Video/ImageBitmap.
   * Returns { fallProb, pNonFall, inferMs }.
   */
  async infer(imageData) {
    if (!this.model) throw new Error('TFLite model not loaded');

    const start = performance.now();

    // Normalize inputs into ImageData
    let data, width, height;
    if (imageData instanceof ImageData) {
      ({ data, width, height } = imageData);
    } else if (imageData && typeof imageData === 'object') {
      // Draw into an offscreen canvas to get ImageData
      const w = this.inputSize, h = this.inputSize;
      const cvs = document.createElement('canvas');
      cvs.width = w; cvs.height = h;
      const ctx = cvs.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      ctx.drawImage(imageData, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      data = img.data; width = img.width; height = img.height;
    } else {
      throw new Error('Unsupported input for inference');
    }

    const res = tf.tidy(() => {
      const t = tf.tensor(data, [height, width, 4]);
      const rgb = tf.slice(t, [0, 0, 0], [height, width, 3]);
      const batched = tf.reshape(rgb, [1, height, width, 3]);
      let input = tf.cast(batched, 'float32');
      if (this.normalize01) input = tf.div(input, 255);
      const y = this.model.predict(input);
      return { input, y };
    });

    try {
      const y = res.y;
      const yData = await y.data();
      const arr = Array.from(yData).map((v) => Number(v));
      let fallProb = 0;
      let pNonFall = 0;

      if (arr.length >= 2) {
        // Two-class output: [nonfall, fall] (logits or probs)
        let vals = arr.slice(0, 2);
        // Heuristic: if values look quantized [0..255], dequantize to [0..1]
        if (vals.every(v => v >= 0 && v <= 255) && vals.some(v => v > 1)) {
          vals = vals.map(v => v / 255);
        }
        // Softmax for stability
        const mx = Math.max(vals[0], vals[1]);
        const e0 = Math.exp(vals[0] - mx);
        const e1 = Math.exp(vals[1] - mx);
        const s = e0 + e1 || 1;
        pNonFall = e0 / s;
        fallProb = e1 / s;
      } else {
        // Single-output: assume it's P(nonfall)
        pNonFall = Number(arr[0] || 0);
        if (pNonFall > 1) pNonFall = pNonFall / 255;
        if (pNonFall < 0) pNonFall = 0;
        if (pNonFall > 1) pNonFall = 1;
        fallProb = 1 - pNonFall;
      }

      const inferMs = performance.now() - start;
      return { fallProb, pNonFall, inferMs };
    } finally {
      res.y.dispose();
      res.input.dispose();
    }
  }
}

export default FallTFLiteRunner;


