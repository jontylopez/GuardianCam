const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { body, validationResult } = require("express-validator");
const { getFirestore } = require("../config/firebase");

const router = express.Router();

// Configure multer for video upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || "./uploads";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Allow video files
    const allowedTypes = /mp4|avi|mov|mkv|webm/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
});

// Start fall detection monitoring
router.post(
  "/start-monitoring",
  [
    body("location").optional().isString(),
    body("sensitivity").optional().isFloat({ min: 0.1, max: 1.0 }),
    body("alertRadius").optional().isInt({ min: 100, max: 10000 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { location, sensitivity = 0.7, alertRadius = 1000 } = req.body;
      const userId = req.user.uid;
      const db = getFirestore();

      // Create monitoring session
      const sessionData = {
        userId,
        status: "active",
        location,
        sensitivity,
        alertRadius,
        startTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sessionRef = await db
        .collection("monitoring_sessions")
        .add(sessionData);
      const sessionId = sessionRef.id;

      // Update user preferences
      await db.collection("users").doc(userId).update({
        "preferences.fallDetectionEnabled": true,
        "preferences.alertRadius": alertRadius,
        updatedAt: new Date(),
      });

      res.status(201).json({
        message: "Fall detection monitoring started",
        sessionId,
        session: {
          id: sessionId,
          ...sessionData,
        },
      });
    } catch (error) {
      console.error("Start monitoring error:", error);
      res.status(500).json({
        error: "Failed to start monitoring",
        message: "Internal server error",
      });
    }
  }
);

// Stop fall detection monitoring
router.post("/stop-monitoring", async (req, res) => {
  try {
    const userId = req.user.uid;
    const db = getFirestore();

    // Find active session
    const sessionsRef = db.collection("monitoring_sessions");
    const snapshot = await sessionsRef
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .get();

    if (snapshot.empty) {
      return res.status(404).json({
        error: "No active session found",
        message: "No active monitoring session found",
      });
    }

    const sessionDoc = snapshot.docs[0];
    await sessionDoc.ref.update({
      status: "stopped",
      endTime: new Date(),
      updatedAt: new Date(),
    });

    // Update user preferences
    await db.collection("users").doc(userId).update({
      "preferences.fallDetectionEnabled": false,
      updatedAt: new Date(),
    });

    res.json({
      message: "Fall detection monitoring stopped",
      sessionId: sessionDoc.id,
    });
  } catch (error) {
    console.error("Stop monitoring error:", error);
    res.status(500).json({
      error: "Failed to stop monitoring",
      message: "Internal server error",
    });
  }
});

// Upload video for fall detection analysis
router.post(
  "/analyze-video",
  upload.single("video"),
  [
    body("location").optional().isString(),
    body("description").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "No video file provided",
          message: "Please upload a video file",
        });
      }

      const { location, description } = req.body;
      const userId = req.user.uid;
      const db = getFirestore();

      // Create analysis record
      const analysisData = {
        userId,
        videoPath: req.file.path,
        videoName: req.file.originalname,
        location,
        description,
        status: "processing",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const analysisRef = await db
        .collection("fall_analyses")
        .add(analysisData);
      const analysisId = analysisRef.id;

      // Integrate with Python model for fall detection
      const PythonModelIntegration = require("../utils/pythonModelIntegration");
      const modelIntegration = new PythonModelIntegration();

      // Process video with Python model
      modelIntegration
        .processVideo(req.file.path, {
          sensitivity: 0.7,
          confidence: 0.8,
        })
        .then(async (result) => {
          try {
            await analysisRef.update({
              status: "completed",
              result: {
                fallDetected: result.fallDetected,
                confidence: result.confidence,
                timestamp: result.timestamp,
                modelVersion: result.modelVersion,
                processingTime: result.processingTime,
                frames: result.frames,
                simulation: result.simulation || false,
              },
              updatedAt: new Date(),
            });

            // If fall detected, create alert
            if (result.fallDetected) {
              await db.collection("alerts").add({
                userId,
                analysisId,
                type: "fall_detected",
                severity: "high",
                message: "Potential fall detected in video analysis",
                location,
                createdAt: new Date(),
                status: "active",
              });
            }
          } catch (error) {
            console.error("Analysis processing error:", error);
            await analysisRef.update({
              status: "failed",
              error: error.message,
              updatedAt: new Date(),
            });
          }
        })
        .catch(async (error) => {
          console.error("Model processing error:", error);
          await analysisRef.update({
            status: "failed",
            error: error.message,
            updatedAt: new Date(),
          });
        });

      res.status(202).json({
        message: "Video analysis started",
        analysisId,
        status: "processing",
      });
    } catch (error) {
      console.error("Video analysis error:", error);
      res.status(500).json({
        error: "Failed to analyze video",
        message: "Internal server error",
      });
    }
  }
);

// Get analysis results
router.get("/analysis/:analysisId", async (req, res) => {
  try {
    const { analysisId } = req.params;
    const userId = req.user.uid;
    const db = getFirestore();

    const analysisDoc = await db
      .collection("fall_analyses")
      .doc(analysisId)
      .get();

    if (!analysisDoc.exists) {
      return res.status(404).json({
        error: "Analysis not found",
        message: "Analysis record not found",
      });
    }

    const analysisData = analysisDoc.data();

    // Check if user owns this analysis
    if (analysisData.userId !== userId) {
      return res.status(403).json({
        error: "Access denied",
        message: "You can only view your own analyses",
      });
    }

    res.json({
      analysis: {
        id: analysisId,
        ...analysisData,
      },
    });
  } catch (error) {
    console.error("Get analysis error:", error);
    res.status(500).json({
      error: "Failed to get analysis",
      message: "Internal server error",
    });
  }
});

// Get user's analysis history
router.get("/analysis-history", async (req, res) => {
  try {
    const userId = req.user.uid;
    const db = getFirestore();

    const analysesRef = db.collection("fall_analyses");
    const snapshot = await analysesRef
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const analyses = [];
    snapshot.forEach((doc) => {
      analyses.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    res.json({
      analyses,
      count: analyses.length,
    });
  } catch (error) {
    console.error("Get analysis history error:", error);
    res.status(500).json({
      error: "Failed to get analysis history",
      message: "Internal server error",
    });
  }
});

// Get current monitoring status
router.get("/monitoring-status", async (req, res) => {
  try {
    const userId = req.user.uid;
    const db = getFirestore();

    const sessionsRef = db.collection("monitoring_sessions");
    const snapshot = await sessionsRef
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .limit(1)
      .get();

    const isMonitoring = !snapshot.empty;
    const currentSession = isMonitoring
      ? {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
        }
      : null;

    res.json({
      isMonitoring,
      currentSession,
    });
  } catch (error) {
    console.error("Get monitoring status error:", error);
    res.status(500).json({
      error: "Failed to get monitoring status",
      message: "Internal server error",
    });
  }
});

module.exports = router;
