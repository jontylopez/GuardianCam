import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { POSE_CONNECTIONS } from '@mediapipe/pose';
import { FaceDetection } from '@mediapipe/face_detection';
import FallTFLiteRunner from './fallModel';

class HumanDetectionService {
  constructor() {
    this.pose = null;
    this.faceDetection = null;
    this.camera = null;
    this.isInitialized = false;
    this.landmarkHistory = new Map();
    this.historyLength = 10;
    this.movementThreshold = 0.02;
    this.fallRiskThreshold = 0.6;
    this.canvas = null;
    this.video = null;
    this.lastPoseResults = null;
    this.lastFaceResults = null;
    this.faceDetectionEnabled = true; // Flag to control face detection
    
    // Throttling for drawing operations
    this.lastDrawTime = 0;
    this.drawThrottleMs = 100; // Only draw every 100ms
    
    // Movement tracking
    this.lastPoseLandmarks = null;
    this.movementAnalysis = {
      isHumanPresent: false,
      isMoving: false,
      fallRisk: false,
      fallConfidence: 0.0,
      confidence: 0.0,
      bodyParts: {
        head: { isMoving: false, velocity: 0, confidence: 0 },
        arms: { isMoving: false, velocity: 0, confidence: 0 },
        legs: { isMoving: false, velocity: 0, confidence: 0 },
        torso: { isMoving: false, velocity: 0, confidence: 0 }
      }
    };

    // Tunables for advanced movement analysis (less sensitive)
    this.prevTimestamp = null;
    this.alpha = 0.25;      // more responsive smoothing
    this.velAlpha = 0.60;   // faster velocity EMA
    this.noiseEMA = 0.0025; // slightly higher baseline
    this.noiseAlpha = 0.05; // update rate for noise

    // Hysteresis state per body part (prevents jittery toggling)
    this._partMoving = { head: false, arms: false, legs: false, torso: false };
    this._lastMovementDiag = 0;

    // Fall classifier via TFLite
    this.fallRunner = null;
    this.fallProb = 0;
    this.fallDetected = false;
    this.fallThreshold = 0.50; // base threshold
    this._fallBuffer = [];
    this._fallWindow = 12;
    this._fallK = 6;
    this._fallEma = 0; // EMA smoothing of fall prob
    this._fallEmaAlpha = 0.30;
    this._roiCanvas = null; // offscreen ROI canvas
    this._adaptiveBoostUntil = 0; // timestamp until which threshold is lowered
  }

  // Smooth value a<-EMA(a, x)
  ema(prev, x, alpha) { return prev == null ? x : (alpha * x + (1 - alpha) * prev); }

  // Helper distance in normalized image space
  distance2D(a, b) {
    const dx = (a?.x ?? 0) - (b?.x ?? 0);
    const dy = (a?.y ?? 0) - (b?.y ?? 0);
    return Math.hypot(dx, dy);
  }

  // Body scale: shoulder-hip avg distance (normalized 0..1). Robust to distance-to-camera.
  computeBodyScale(lms) {
    const hasVis = [11, 12, 23, 24].every(i => (lms[i]?.visibility ?? 0) > 0.5);
    if (!hasVis) return 0.25; // fallback
    const sh = (this.distance2D(lms[11], lms[12]) + this.distance2D(lms[23], lms[24])) / 2;
    const torso = (this.distance2D(lms[11], lms[23]) + this.distance2D(lms[12], lms[24])) / 2;
    return Math.max(0.08, (sh + torso) / 2); // lower clamp helps far subjects
  }

  // One-time probe: try sources in order, return the first that responds OK for a single known file.
  async pickFirstWorkingBase(baseUrls, testFile) {
    for (const base of baseUrls) {
      try {
        const resp = await fetch(`${base}/${testFile}`, { method: 'HEAD' });
        if (resp.ok) return base;
      } catch (_) { /* ignore and continue */ }
    }
    // fall back to the first URL even if probes fail
    return baseUrls[0];
  }

  // Synchronous locateFile factory: returns a plain string (NO async!)
  createSyncLocateFile(resolvedBaseUrl) {
    return (file) => `${resolvedBaseUrl}/${file}`;
  }

  async initialize() {
    try {
      console.log('Initializing Human Detection Service...');
      
      // Use local assets for CORS-free loading
      const poseBase = '/mediapipe/pose';
      const faceBase = '/mediapipe/face_detection';
      const locateFrom = (base) => (file) => `${base}/${file}`;
      
      // Initialize MediaPipe Pose
      try {
        this.pose = new Pose({
          locateFile: locateFrom(poseBase)
        });
        this.pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: true,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7
        });
        this.pose.onResults((results) => {
          console.log('Pose detection results:', results);
          this.processPoseResults(results);
        });
        console.log('Pose detection initialized successfully');
      } catch (poseError) {
        console.error('Pose detection failed to initialize:', poseError);
        return false;
      }

      // Initialize MediaPipe Face Detection with error handling
      try {
        this.faceDetection = new FaceDetection({
          locateFile: locateFrom(faceBase)
        });
        this.faceDetection.setOptions({
          modelSelection: 1,
          minDetectionConfidence: 0.7
        });
        this.faceDetection.onResults((results) => {
          console.log('Face detection results:', results);
          this.processFaceResults(results);
        });
        this.faceDetectionEnabled = true;
        console.log('Face detection initialized successfully');
        // Quick check that the model is served locally (non-blocking)
        fetch('/mediapipe/face_detection/face_detection_short_range.tflite')
          .then(r => console.log('tflite fetch status', r.status))
          .catch(e => console.error('tflite fetch failed', e));
      } catch (faceError) {
        console.warn('Face detection init failed, disabling.', faceError);
        this.faceDetection = null;
        this.faceDetectionEnabled = false;
      }

      this.isInitialized = true;
      // Lazy-init fall model runner
      try {
        this.fallRunner = new FallTFLiteRunner();
        await this.fallRunner.load('/image_model/fall_cls.tflite', '/image_model/fall_cls_int8.tflite');
        console.log('Fall TFLite model loaded');
      } catch (e) {
        console.warn('Fall TFLite model failed to load:', e);
        this.fallRunner = null;
      }
      console.log('Human Detection Service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Human Detection Service:', error);
      return false;
    }
  }

  processPoseResults(results) {
    if (!results.poseLandmarks) {
      this.movementAnalysis.isHumanPresent = false;
      this.movementAnalysis.isMoving = false;
      return;
    }

    this.movementAnalysis.isHumanPresent = true;
    
    // Process landmarks for movement detection
    const currentLandmarks = results.poseLandmarks;
    this.detectMovement(currentLandmarks);
    this.analyzeFallRisk(currentLandmarks);
    
    // Update last pose landmarks
    this.lastPoseLandmarks = currentLandmarks;

    // Store pose results for drawing
    this.lastPoseResults = results;
    
    // Draw everything on canvas (throttled)
    this.throttledDrawAllDetections();
  }

  processFaceResults(results) {
    if (!results || !results.detections) return;
    
    // Store face results for drawing
    this.lastFaceResults = results;
    
    // Draw everything on canvas (throttled)
    this.throttledDrawAllDetections();
  }

  detectMovement(currentLandmarks) {
    const now = performance.now();
    const dt = this.prevTimestamp ? Math.max(0.016, (now - this.prevTimestamp) / 1000) : 1 / 30;
    this.prevTimestamp = now;

    // --- landmark smoothing ---
    if (!this._smoothed) this._smoothed = currentLandmarks.map(l => ({ ...l }));
    for (let i = 0; i < currentLandmarks.length; i++) {
      const c = currentLandmarks[i];
      const s = this._smoothed[i];
      if ((c.visibility ?? 0) > 0.2) {
        s.x = this.ema(s.x, c.x, this.alpha);
        s.y = this.ema(s.y, c.y, this.alpha);
        s.z = this.ema(s.z ?? 0, c.z ?? 0, this.alpha);
        s.visibility = c.visibility;
      } else {
        s.visibility = c.visibility;
      }
    }

    const lms = this._smoothed;
    const scale = this.computeBodyScale(lms);

    // --- per-landmark velocity (scale-normalized) ---
    if (!this._prevLms) this._prevLms = lms.map(p => ({ x: p.x, y: p.y, vis: p.visibility }));
    if (!this._velEma) this._velEma = new Array(lms.length).fill(0);

    const partMap = {
      head: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      arms: [11, 12, 13, 14, 15, 16],
      legs: [23, 24, 25, 26, 27, 28, 31, 32],
      torso: [11, 12, 23, 24]
    };

    const partStats = { head: [], arms: [], legs: [], torso: [] };
    let totalVel = 0, countVel = 0;

    for (let i = 0; i < lms.length; i++) {
      const p = lms[i], q = this._prevLms[i];
      if ((p.visibility ?? 0) > 0.30 && (q?.vis ?? 0) > 0.30) {
        const vx = (p.x - q.x) / dt;
        const vy = (p.y - q.y) / dt;
        let v = Math.hypot(vx, vy) / Math.max(1e-3, scale);
        this._velEma[i] = this.ema(this._velEma[i], v, this.velAlpha);
        v = this._velEma[i];

        totalVel += v; countVel++;
        for (const [name, idxs] of Object.entries(partMap)) {
          if (idxs.includes(i)) partStats[name].push(v);
        }
      }
      this._prevLms[i] = { x: p.x, y: p.y, vis: p.visibility };
    }

    // --- adaptive noise floor ---
    const meanVel = countVel ? totalVel / countVel : 0;
    const likelyStill = meanVel < (this.noiseEMA * 3);
    this.noiseEMA = this.ema(this.noiseEMA, meanVel, likelyStill ? this.noiseAlpha : 0.01);

    // --- thresholds + HYSTERESIS (scaled for distance) ---
    // Reduce thresholds more when subject appears small (far from camera)
    const distanceFactor = (scale < 0.10) ? 0.70 : (scale < 0.16 ? 0.85 : 1.0);
    const baseLow  = Math.max(0.0015, this.noiseEMA * 3.2) * distanceFactor;  // keep-moving threshold
    const baseHigh = Math.max(0.0022, this.noiseEMA * 4.8) * distanceFactor;  // start-moving threshold

    const isMovingPart = (name, arr) => {
      if (!arr.length) return false;
      const sorted = [...arr].sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      const prev = this._partMoving[name] === true;
      // hysteresis: require higher threshold to turn on, lower to stay on
      const moving = prev ? (med > baseLow) : (med > baseHigh);
      this._partMoving[name] = moving;
      return moving;
    };

    // --- update per-part movement ---
    for (const name of Object.keys(partMap)) {
      const arr = partStats[name];
      const vel = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const moving = isMovingPart(name, arr);
      this.movementAnalysis.bodyParts[name] = {
        isMoving: moving,
        velocity: vel,
        confidence: arr.length / partMap[name].length
      };
    }

    // --- overall movement is stricter too ---
    const movingParts = Object.values(this.movementAnalysis.bodyParts).filter(p => p.isMoving).length;
    this.movementAnalysis.isMoving = (movingParts >= 1) || (meanVel > baseHigh);
    this.movementAnalysis.confidence = Math.max(0, Math.min(1, meanVel / (baseHigh * 1.3)));

    // Low-frequency diagnostics to help tuning (every ~2s)
    const nowTs = Date.now();
    if (!this._lastMovementDiag || nowTs - this._lastMovementDiag > 2000) {
      console.log('[movement] scale', scale.toFixed(3), 'meanVel', meanVel.toFixed(4), 'baseLow', baseLow.toFixed(4), 'baseHigh', baseHigh.toFixed(4), 'parts', movingParts);
      this._lastMovementDiag = nowTs;
    }
  }

  analyzeFallRisk(lms) {
    if (!lms || lms.length < 33) return;

    // Helpers
    const vis = (i) => ((lms[i]?.visibility ?? 0) > 0.5);
    const V = (i) => lms[i];

    let score = 0;

    // Torso tilt (shoulder->hip vector vs vertical)
    if (vis(11) && vis(12) && vis(23) && vis(24)) {
      const sh = { x: (V(11).x + V(12).x) / 2, y: (V(11).y + V(12).y) / 2 };
      const hp = { x: (V(23).x + V(24).x) / 2, y: (V(23).y + V(24).y) / 2 };
      const vx = hp.x - sh.x, vy = hp.y - sh.y;
      const up = { x: 0, y: 1 }; // canvas y+ is down; vertical reference
      const dot = (vx * up.x + vy * up.y) / (Math.hypot(vx, vy) * Math.hypot(up.x, up.y));
      // dot close to 1 = torso vertical; near 0 = horizontal
      const torsoHorizontal = dot < 0.4; // ~ > 66° tilt
      if (torsoHorizontal) {
        score += 1.5;
        // Adaptive threshold boost for a short window when torso goes horizontal
        this._adaptiveBoostUntil = Math.max(this._adaptiveBoostUntil, Date.now() + 800);
      }
    }

    // Head rapid downward velocity (scale-normalized)
    if (!this._prevHead) this._prevHead = { y: null, t: null };
    if (vis(0)) {
      const now = performance.now();
      const dt = this._prevHead.t ? Math.max(0.016, (now - this._prevHead.t) / 1000) : 1 / 30;
      const vy = (V(0).y - (this._prevHead.y ?? V(0).y)) / dt; // +down
      const scale = this.computeBodyScale(lms);
      const vnorm = Math.abs(vy) / Math.max(1e-3, scale);
      if (vy > 0 && vnorm > 2.5) {
        score += 1.0; // sharp drop
        // Temporarily lower threshold after sharp downward head motion
        this._adaptiveBoostUntil = Math.max(this._adaptiveBoostUntil, Date.now() + 1200);
      }
      this._prevHead = { y: V(0).y, t: now };
    }

    // Body height collapse (minY..maxY shrinks quickly)
    const visPts = lms.filter(p => (p.visibility ?? 0) > 0.5);
    if (visPts.length > 8) {
      const ys = visPts.map(p => p.y);
      const heightNow = Math.max(...ys) - Math.min(...ys);
      if (!this._hNow) this._hNow = heightNow;
      const dh = this._hNow - heightNow; // positive if collapsing
      // Keep EMA of height for stability
      this._hNow = this.ema(this._hNow, heightNow, 0.3);
      if (dh > 0.12) score += 0.8;
    }

    // Legs under hips (knees y > hips y)
    if (vis(25) && vis(26) && vis(23) && vis(24)) {
      const kneeY = (V(25).y + V(26).y) / 2;
      const hipY = (V(23).y + V(24).y) / 2;
      if (kneeY > hipY + 0.03) score += 0.5;
    }

    this.movementAnalysis.fallRisk = score >= 2.0;
    this.movementAnalysis.fallConfidence = Math.max(0, Math.min(1, score / 4.0));
  }

  async startDetection(videoElement, canvasElement) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }

    if (!videoElement || !canvasElement) {
      console.error('Invalid video or canvas element provided');
      return false;
    }

    try {
      this.video = videoElement;
      this.canvas = canvasElement;
      // Ensure video element is ready
      if (!this.video.videoWidth || !this.video.videoHeight) {
        console.log('Waiting for video to be ready...');
        await new Promise((resolve) => {
          this.video.onloadedmetadata = resolve;
          // Fallback timeout
          setTimeout(resolve, 5000);
        });
      }
      
      console.log('Video dimensions:', this.video.videoWidth, 'x', this.video.videoHeight);
      console.log('Canvas dimensions:', this.canvas.width, 'x', this.canvas.height);
      
      // Validate canvas dimensions
      if (this.canvas.width === 0 || this.canvas.height === 0) {
        console.error('Canvas has invalid dimensions');
        return false;
      }
      
      // Set up camera
      this.camera = new Camera(videoElement, {
        onFrame: async () => {
          try {
          if (this.pose) {
              await this.pose.send({ image: videoElement });
            }
              if (this.faceDetection && this.faceDetectionEnabled) {
                try {
                  await this.faceDetection.send({ image: videoElement });
              } catch (fe) {
                console.warn('Face detection frame failed:', fe?.message || fe);
              }
            }
            // Run fall classification at a throttled rate
            this._maybeRunFallModel();
          } catch (pe) {
            console.warn('Pose frame failed:', pe?.message || pe);
          }
        },
        width: 640,
        height: 480
      });

      await this.camera.start();
      // Diagnostic: log and wait if video size is not ready
      console.log('camera started -> video', this.video?.videoWidth, this.video?.videoHeight);
      if (!this.video?.videoWidth || !this.video?.videoHeight) {
        await new Promise(r => setTimeout(r, 100));
        console.log('retry sizes ->', this.video?.videoWidth, this.video?.videoHeight);
      }
      console.log('Human detection started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start human detection:', error);
      return false;
    }
  }

  async _maybeRunFallModel() {
    if (!this.fallRunner || !this.video) return;
    // Simple throttle using drawThrottleMs window
    const now = Date.now();
    if (!this._lastFallRun) this._lastFallRun = 0;
    if (now - this._lastFallRun < 1000 / 12) { // ~12 fps
      return;
    }
    this._lastFallRun = now;

    try {
      // Prefer ROI around the person if pose landmarks available
      let inputSource = this.video;
      const lms = this.lastPoseResults?.poseLandmarks;
      if (lms && Array.isArray(lms) && lms.length >= 33) {
        const roi = this._getPersonRoi(this.video, lms, 0.30);
        if (roi) inputSource = roi;
      }

      const res = await this.fallRunner.infer(inputSource);
      this.fallProb = res.fallProb;

      // EMA smoothing and windowed buffer (for robustness)
      this._fallEma = this._fallEma == null ? this.fallProb : (this._fallEmaAlpha * this.fallProb + (1 - this._fallEmaAlpha) * this._fallEma);
      const smoothed = this._fallEma;
      this._fallBuffer.push(smoothed);
      if (this._fallBuffer.length > this._fallWindow) this._fallBuffer.shift();
      const meanSmoothed = this._fallBuffer.reduce((a, c) => a + c, 0) / (this._fallBuffer.length || 1);

      // Adaptive thresholding window
      const adaptiveActive = now < this._adaptiveBoostUntil;
      const effThreshold = Math.max(0.30, this.fallThreshold - (adaptiveActive ? 0.15 : 0));

      if (meanSmoothed >= effThreshold) {
        this._fallConsec = (this._fallConsec || 0) + 1;
      } else {
        this._fallConsec = 0;
      }
      const detected = (this._fallConsec || 0) >= this._fallK;
      this.fallDetected = detected;

      // Map into movementAnalysis for UI consumption
      this.movementAnalysis.fallRisk = this.fallDetected || this.movementAnalysis.fallRisk;
      this.movementAnalysis.fallConfidence = Math.max(this.movementAnalysis.fallConfidence, meanSmoothed);
    } catch (e) {
      // Non-fatal
      // console.warn('Fall model inference failed:', e?.message || e);
    }
  }

  // Build an ROI canvas centered on visible pose landmarks with a margin.
  _getPersonRoi(videoEl, landmarks, marginRatio = 0.2) {
    if (!videoEl || !landmarks?.length) return null;
    let minX = 1, minY = 1, maxX = 0, maxY = 0, visCount = 0;
    for (const lm of landmarks) {
      if ((lm.visibility ?? 0) > 0.5) {
        minX = Math.min(minX, lm.x);
        minY = Math.min(minY, lm.y);
        maxX = Math.max(maxX, lm.x);
        maxY = Math.max(maxY, lm.y);
        visCount++;
      }
    }
    if (visCount === 0) return null;

    // Expand with margin and clamp
    const mx = marginRatio;
    let x0 = Math.max(0, minX - mx), y0 = Math.max(0, minY - mx);
    let x1 = Math.min(1, maxX + mx), y1 = Math.min(1, maxY + mx);
    let w = Math.max(0.05, x1 - x0), h = Math.max(0.05, y1 - y0);
    // Make square crop to match classifier aspect
    const size = Math.max(w, h);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = Math.max(0, Math.min(1 - size, cx - size / 2));
    y0 = Math.max(0, Math.min(1 - size, cy - size / 2));
    w = size; h = size;

    const sx = Math.floor(x0 * videoEl.videoWidth);
    const sy = Math.floor(y0 * videoEl.videoHeight);
    const sw = Math.max(8, Math.floor(w * videoEl.videoWidth));
    const sh = Math.max(8, Math.floor(h * videoEl.videoHeight));

    const target = 224;
    const cvs = (this._roiCanvas ||= document.createElement('canvas'));
    cvs.width = target; cvs.height = target;
    const ctx = cvs.getContext('2d');
    if (!ctx) return null;
    try {
      ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, target, target);
      return cvs;
    } catch (_) {
      return null;
    }
  }

  stopDetection() {
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }
    console.log('Human detection stopped');
  }

  getDetectionResults() {
    return {
      ...this.movementAnalysis,
      fallProb: this.fallProb,
      fallDetected: this.fallDetected,
      timestamp: Date.now(),
      faceDetectionEnabled: this.faceDetectionEnabled,
      faceDetectionAvailable: !!this.faceDetection
    };
  }

  // Get service status information
  getServiceStatus() {
    return {
      isInitialized: this.isInitialized,
      poseAvailable: !!this.pose,
      faceDetectionEnabled: this.faceDetectionEnabled,
      faceDetectionAvailable: !!this.faceDetection,
      cameraRunning: !!this.camera
    };
  }

  // Validate service configuration
  validateConfiguration() {
    const issues = [];
    
    if (!this.isInitialized) {
      issues.push('Service not initialized');
    }
    
    if (!this.pose) {
      issues.push('Pose detection not available');
    }
    
    if (this.faceDetectionEnabled && !this.faceDetection) {
      issues.push('Face detection enabled but not available');
    }
    
    if (!this.video) {
      issues.push('Video element not set');
    }
    
    if (!this.canvas) {
      issues.push('Canvas element not set');
    }
    
    if (this.canvas && (this.canvas.width === 0 || this.canvas.height === 0)) {
      issues.push('Canvas has invalid dimensions');
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues
    };
  }

  // Draw pose landmarks on canvas (modified to accept context)
  drawPoseLandmarks(ctx, landmarks) {
    if (!landmarks || !ctx) return;
    
    console.log('Drawing pose landmarks with count:', landmarks.length);
    
    // Convert normalized coordinates to canvas coordinates
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    
    // Draw pose connections (skeleton)
    drawConnectors(ctx, landmarks, POSE_CONNECTIONS, {
      color: '#00FF00',
      lineWidth: 2
    });

    // Draw pose landmarks (joints)
    drawLandmarks(ctx, landmarks, {
      color: '#FF0000',
      lineWidth: 1,
      radius: 3
    });
    
    // Draw a simple bounding box around the person
    this.drawPersonBoundingBox(ctx, landmarks, canvasWidth, canvasHeight);
  }

  // Draw a bounding box around the detected person
  drawPersonBoundingBox(ctx, landmarks, canvasWidth, canvasHeight) {
    if (!landmarks || landmarks.length === 0 || !ctx) return;
    
    // Find the bounds of all visible landmarks
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    let visibleCount = 0;
    
    landmarks.forEach(landmark => {
      if (landmark.visibility > 0.5) {
        minX = Math.min(minX, landmark.x);
        minY = Math.min(minY, landmark.y);
        maxX = Math.max(maxX, landmark.x);
        maxY = Math.max(maxY, landmark.y);
        visibleCount++;
      }
    });
    
    if (visibleCount > 0) {
      // Convert to canvas coordinates
      const x = minX * canvasWidth;
      const y = minY * canvasHeight;
      const width = (maxX - minX) * canvasWidth;
      const height = (maxY - minY) * canvasHeight;
      
      // Draw bounding box
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // Add label
      ctx.fillStyle = '#00FF00';
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Person', x, y - 10);
    }
  }

  // Draw face detections on canvas (modified to accept context)
  drawFaceDetections(ctx, detections) {
    if (!detections?.length || !ctx) return;
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    for (const detection of detections) {
      const r = detection.locationData?.relativeBoundingBox;
      if (!r) continue;
      const x = r.xMin * canvasWidth;
      const y = r.yMin * canvasHeight;
      const w = r.width * canvasWidth;
      const h = r.height * canvasHeight;

      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      const sc = detection.score?.[0];
      if (typeof sc === 'number') {
      ctx.fillStyle = '#00FFFF';
        ctx.font = '12px Arial';
        ctx.fillText(`${(sc * 100).toFixed(1)}%`, x, Math.max(10, y - 6));
      }
    }
  }

  // Draw movement indicators
  drawMovementIndicators(ctx, landmarks) {
    if (!landmarks || !ctx) return;

    // Draw movement status for each body part
    let yOffset = 30;
    const lineHeight = 20;

    Object.entries(this.movementAnalysis.bodyParts).forEach(([partName, data]) => {
      const color = data.isMoving ? '#00FF00' : '#888888';
      const text = `${partName}: ${data.isMoving ? 'Moving' : 'Still'} (${data.velocity.toFixed(3)})`;
      
      ctx.fillStyle = color;
      ctx.font = '14px Arial';
      ctx.fillText(text, 10, yOffset);
      yOffset += lineHeight;
    });

    // Draw fall risk warning
    if (this.movementAnalysis.fallRisk) {
      ctx.fillStyle = '#FF0000';
      ctx.font = 'bold 20px Arial';
      ctx.fillText('FALL RISK!', 10, yOffset + 20);
    }

    // Draw overall status
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Arial';
    ctx.fillText(`Human: ${this.movementAnalysis.isHumanPresent ? 'Yes' : 'No'}`, 10, yOffset + 50);
    ctx.fillText(`Moving: ${this.movementAnalysis.isMoving ? 'Yes' : 'No'}`, 10, yOffset + 70);
    ctx.fillText(`Fall Risk: ${this.movementAnalysis.fallRisk ? 'High' : 'Low'}`, 10, yOffset + 90);
  }

  // Throttled drawing method to improve performance
  throttledDrawAllDetections() {
    const now = Date.now();
    if (now - this.lastDrawTime >= this.drawThrottleMs) {
      this.drawAllDetections();
      this.lastDrawTime = now;
    }
  }

  // Draw all detections on canvas
  drawAllDetections() {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear and draw the current video frame first
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.video?.readyState >= 2) {
      ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    }

    // Then overlays
    if (this.lastPoseResults?.poseLandmarks) {
      this.drawPoseLandmarks(ctx, this.lastPoseResults.poseLandmarks);
    }
    if (this.lastFaceResults?.detections?.length) {
      this.drawFaceDetections(ctx, this.lastFaceResults.detections);
    }
    if (this.lastPoseResults?.poseLandmarks) {
      this.drawMovementIndicators(ctx, this.lastPoseResults.poseLandmarks);
    }
  }

  // Retry face detection initialization
  async retryFaceDetection() {
    if (this.faceDetection || !this.faceDetectionEnabled) {
      console.log('Face detection already available or disabled');
      return false;
    }

    try {
      console.log('Retrying face detection initialization...');

      this.faceDetection = new FaceDetection({
        locateFile: (file) => `/mediapipe/face_detection/${file}`
      });
      
      this.faceDetection.setOptions({
        modelSelection: 1,
        minDetectionConfidence: 0.7
      });
      
      this.faceDetection.onResults((results) => {
        console.log('Face detection results:', results);
        this.processFaceResults(results);
      });
      
      this.faceDetectionEnabled = true;
      console.log('Face detection retry successful');
      return true;
    } catch (error) {
      console.error('Face detection retry failed:', error);
      this.faceDetection = null;
      this.faceDetectionEnabled = false;
      return false;
    }
  }

  // Cleanup
  dispose() {
    this.stopDetection();
    if (this.pose) {
      this.pose.close();
      this.pose = null;
    }
    if (this.faceDetection) {
      this.faceDetection.close();
      this.faceDetection = null;
    }
    this.isInitialized = false;
  }
}

export default HumanDetectionService;
