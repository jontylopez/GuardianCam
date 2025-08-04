const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

class PythonModelIntegration {
  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || "python";
    this.modelPath = path.join(__dirname, "../../PythonModel");
    this.scriptPath = path.join(this.modelPath, "fall_detection.py");
  }

  /**
   * Process video file using Python fall detection model
   * @param {string} videoPath - Path to the video file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Detection results
   */
  async processVideo(videoPath, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        // Check if video file exists
        if (!fs.existsSync(videoPath)) {
          throw new Error("Video file not found");
        }

        // Check if Python script exists
        if (!fs.existsSync(this.scriptPath)) {
          console.warn(
            "Python model script not found, using fallback simulation"
          );
          return this.simulateFallDetection(videoPath, options);
        }

        const args = [
          this.scriptPath,
          "--video",
          videoPath,
          "--output",
          "json",
        ];

        // Add optional parameters
        if (options.sensitivity) {
          args.push("--sensitivity", options.sensitivity.toString());
        }
        if (options.confidence) {
          args.push("--confidence", options.confidence.toString());
        }

        console.log(
          `Running Python model: ${this.pythonPath} ${args.join(" ")}`
        );

        const pythonProcess = spawn(this.pythonPath, args, {
          cwd: this.modelPath,
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        pythonProcess.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        pythonProcess.on("close", (code) => {
          if (code !== 0) {
            console.error("Python model error:", stderr);
            // Fallback to simulation if Python model fails
            return resolve(this.simulateFallDetection(videoPath, options));
          }

          try {
            const result = JSON.parse(stdout);
            resolve({
              fallDetected: result.fall_detected || false,
              confidence: result.confidence || 0.0,
              timestamp: new Date(),
              modelVersion: result.model_version || "1.0.0",
              processingTime: result.processing_time || 0,
              frames: result.frames_processed || 0,
            });
          } catch (parseError) {
            console.error("Failed to parse Python model output:", parseError);
            resolve(this.simulateFallDetection(videoPath, options));
          }
        });

        pythonProcess.on("error", (error) => {
          console.error("Failed to start Python model:", error);
          resolve(this.simulateFallDetection(videoPath, options));
        });
      } catch (error) {
        console.error("Python model integration error:", error);
        resolve(this.simulateFallDetection(videoPath, options));
      }
    });
  }

  /**
   * Simulate fall detection for testing/fallback
   * @param {string} videoPath - Path to the video file
   * @param {Object} options - Processing options
   * @returns {Object} - Simulated detection results
   */
  simulateFallDetection(videoPath, options = {}) {
    const sensitivity = options.sensitivity || 0.7;
    const confidence = options.confidence || 0.8;

    // Simulate processing time based on file size
    const stats = fs.statSync(videoPath);
    const processingTime = Math.min((stats.size / 1024 / 1024) * 1000, 5000); // Max 5 seconds

    // Simulate fall detection with configurable sensitivity
    const isFallDetected = Math.random() > 1 - sensitivity;
    const fallConfidence = isFallDetected
      ? Math.random() * (1 - confidence) + confidence
      : Math.random() * confidence;

    return {
      fallDetected: isFallDetected,
      confidence: fallConfidence,
      timestamp: new Date(),
      modelVersion: "simulation-1.0.0",
      processingTime: processingTime,
      frames: Math.floor(Math.random() * 300) + 100,
      simulation: true,
    };
  }

  /**
   * Get model information
   * @returns {Promise<Object>} - Model information
   */
  async getModelInfo() {
    return new Promise((resolve) => {
      try {
        if (!fs.existsSync(this.scriptPath)) {
          return resolve({
            available: false,
            version: "simulation-1.0.0",
            description: "Fall detection simulation (Python model not found)",
          });
        }

        const pythonProcess = spawn(
          this.pythonPath,
          [this.scriptPath, "--info"],
          {
            cwd: this.modelPath,
            stdio: ["pipe", "pipe", "pipe"],
          }
        );

        let stdout = "";
        let stderr = "";

        pythonProcess.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        pythonProcess.on("close", (code) => {
          if (code !== 0) {
            return resolve({
              available: false,
              version: "simulation-1.0.0",
              description: "Fall detection simulation (Python model error)",
              error: stderr,
            });
          }

          try {
            const info = JSON.parse(stdout);
            resolve({
              available: true,
              ...info,
            });
          } catch (parseError) {
            resolve({
              available: false,
              version: "simulation-1.0.0",
              description: "Fall detection simulation (Parse error)",
            });
          }
        });

        pythonProcess.on("error", () => {
          resolve({
            available: false,
            version: "simulation-1.0.0",
            description: "Fall detection simulation (Process error)",
          });
        });
      } catch (error) {
        resolve({
          available: false,
          version: "simulation-1.0.0",
          description: "Fall detection simulation (Integration error)",
        });
      }
    });
  }

  /**
   * Test model with sample data
   * @returns {Promise<Object>} - Test results
   */
  async testModel() {
    try {
      const modelInfo = await this.getModelInfo();

      if (!modelInfo.available) {
        return {
          success: false,
          message: "Python model not available, using simulation",
          modelInfo,
        };
      }

      // Test with a dummy video path (you can create a test video)
      const testResult = await this.processVideo("test_video.mp4", {
        sensitivity: 0.7,
        confidence: 0.8,
      });

      return {
        success: true,
        message: "Model test completed",
        modelInfo,
        testResult,
      };
    } catch (error) {
      return {
        success: false,
        message: "Model test failed",
        error: error.message,
      };
    }
  }
}

module.exports = PythonModelIntegration;
