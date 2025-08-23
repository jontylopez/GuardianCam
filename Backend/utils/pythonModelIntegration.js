// Deprecated legacy module. Kept as a no-op to avoid import crashes.
class PythonModelIntegration {
    async analyzeFrames() { throw new Error('Python integration removed'); }
    async processVideo() { throw new Error('Python integration removed'); }
    parsePythonOutput() { return {}; }
    async checkModelAvailability() { return false; }
    async getModelStatus() { return { available: false }; }
}

module.exports = PythonModelIntegration;
