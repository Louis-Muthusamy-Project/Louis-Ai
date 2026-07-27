const Kernel = require("../core/Kernel");

/**
 * ==========================================
 * ContextService - Refactored Service Class
 * ==========================================
 */
class ContextService {
    constructor(kernel) {
        this.kernel = kernel;
    }

    get memoryService() {
        return this.kernel.get("memoryService");
    }

    get conversationService() {
        return this.kernel.get("conversationService");
    }

    build(socketId, options = {}) {
        const {
            emotion = "neutral",
            userMessage = "",
            userProfile = {},
            desktopState = {},
            toolResults = [],
            intent = "CHAT",
            relationship = {},
            timeline = [],
            goals = [],
            projects = [],
            memory = null
        } = options;

        const history = this.conversationService.getHistory(socketId);

        const retrievedMemory = memory !== null 
            ? memory 
            : this.memoryService
                .getSummary(socketId)
                .map(item => `${item.role}: ${item.text}`);

        return {
            history,
            memory: retrievedMemory,
            emotion,
            currentTime: new Date(),
            userMessage,
            userProfile,
            desktopState,
            toolResults,
            intent,
            relationship,
            timeline,
            goals,
            projects
        };
    }
}

const wrapper = {
    build: (s, o) => Kernel.get("contextService").build(s, o)
};

module.exports = Object.assign(wrapper, { ContextService });