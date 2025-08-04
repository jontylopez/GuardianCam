const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class PythonModelIntegration {
    constructor() {
        this.pythonPath = 'python3';
        this.modelScriptPath = path.join(__dirname, '../../PythonModel/simple_inference.py');
        this.isProcessing = false;
    }

    /**
     * Process video file with Python fall detection model
     * @param {string} videoPath - Path to video file
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} - Analysis results
     */
    async processVideo(videoPath, options = {}) {
        return new Promise((resolve, reject) => {
            if (this.isProcessing) {
                reject(new Error('Model is already processing another video'));
                return;
            }

            this.isProcessing = true;

            // Check if video file exists
            if (!fs.existsSync(videoPath)) {
                this.isProcessing = false;
                reject(new Error('Video file not found'));
                return;
            }

            // Check if Python script exists
            if (!fs.existsSync(this.modelScriptPath)) {
                this.isProcessing = false;
                reject(new Error('Python model script not found'));
                return;
            }

            console.log(`Starting video analysis: ${videoPath}`);

            // Spawn Python process
            const pythonProcess = spawn(this.pythonPath, [
                this.modelScriptPath,
                '--video', videoPath,
                '--sensitivity', options.sensitivity || 0.7,
                '--confidence', options.confidence || 0.8
            ], {
                cwd: path.dirname(this.modelScriptPath)
            });

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`Python stdout: ${data}`);
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.error(`Python stderr: ${data}`);
            });

            pythonProcess.on('close', (code) => {
                this.isProcessing = false;
                
                if (code !== 0) {
                    console.error(`Python process exited with code ${code}`);
                    reject(new Error(`Model processing failed: ${stderr}`));
                    return;
                }

                try {
                    // Parse results from stdout
                    const results = this.parsePythonOutput(stdout);
                    console.log('Video analysis completed successfully');
                    resolve(results);
                } catch (error) {
                    console.error('Error parsing Python output:', error);
                    reject(new Error('Failed to parse model results'));
                }
            });

            pythonProcess.on('error', (error) => {
                this.isProcessing = false;
                console.error('Python process error:', error);
                reject(new Error(`Failed to start model: ${error.message}`));
            });

            // Set timeout
            setTimeout(() => {
                if (this.isProcessing) {
                    pythonProcess.kill();
                    this.isProcessing = false;
                    reject(new Error('Model processing timeout'));
                }
            }, 300000); // 5 minutes timeout
        });
    }

    /**
     * Parse Python script output
     * @param {string} output - Python script stdout
     * @returns {Object} - Parsed results
     */
    parsePythonOutput(output) {
        try {
            // Look for JSON results in the output
            const jsonMatch = output.match(/\{.*\}/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            // Fallback: parse structured output
            const lines = output.split('\n');
            const results = {
                fallDetected: false,
                confidence: 0.0,
                timestamp: new Date().toISOString(),
                modelVersion: '1.0.0',
                processingTime: 0,
                frames: 0,
                simulation: false
            };

            for (const line of lines) {
                if (line.includes('Prediction:')) {
                    results.fallDetected = line.includes('Fall');
                } else if (line.includes('Confidence:')) {
                    const match = line.match(/Confidence:\s*([\d.]+)/);
                    if (match) {
                        results.confidence = parseFloat(match[1]);
                    }
                } else if (line.includes('Processing time:')) {
                    const match = line.match(/Processing time:\s*([\d.]+)/);
                    if (match) {
                        results.processingTime = parseFloat(match[1]);
                    }
                } else if (line.includes('Frames processed:')) {
                    const match = line.match(/Frames processed:\s*(\d+)/);
                    if (match) {
                        results.frames = parseInt(match[1]);
                    }
                }
            }

            return results;
        } catch (error) {
            console.error('Error parsing Python output:', error);
            throw new Error('Failed to parse model output');
        }
    }

    /**
     * Check if Python model is available
     * @returns {Promise<boolean>} - Model availability
     */
    async checkModelAvailability() {
        return new Promise((resolve) => {
            const pythonProcess = spawn(this.pythonPath, [
                this.modelScriptPath,
                '--check'
            ], {
                cwd: path.dirname(this.modelScriptPath)
            });

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                resolve(code === 0 && !stderr.includes('Error'));
            });

            pythonProcess.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * Get model status and performance info
     * @returns {Promise<Object>} - Model status
     */
    async getModelStatus() {
        try {
            const isAvailable = await this.checkModelAvailability();
            
            return {
                available: isAvailable,
                scriptPath: this.modelScriptPath,
                isProcessing: this.isProcessing,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                available: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = PythonModelIntegration;
