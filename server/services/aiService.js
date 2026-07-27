const Kernel = require("../core/Kernel");

/**
 * ==========================================
 * AIService - Wrapper for backward compatibility
 * ==========================================
 */
class AIService {
    async generateReply(socketId, userMessage) {
        const orchestrator = Kernel.get("aiOrchestrator");
        return orchestrator.generateReply(socketId, userMessage);
    }

    async streamReply(socketId, userMessage, callbacks = {}) {
        const orchestrator = Kernel.get("aiOrchestrator");
        return orchestrator.streamReply(socketId, userMessage, callbacks);
    }
}

module.exports = new AIService();