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
            emotionState = null,
            personalityDirectives = "",
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

        const history = this.conversationService.getHistory(socketId) || [];
        
        let retrievedMemory = [];
        if (memory !== null) {
            retrievedMemory = memory;
        } else {
            // We expect the orchestration to pass pre-retrieved memory if possible,
            // but fallback to summarizing from memoryService if not.
            retrievedMemory = this.memoryService
                .getSummary(socketId)
                .map(item => `${item.role}: ${item.text}`);
        }

        // Apply strict character limits to ensure we don't blow up the prompt context window
        // Approx 1 token = 4 chars. If limit is 8000 chars, it's roughly 2000 tokens.
        const MAX_HISTORY_CHARS = 4000;
        const MAX_MEMORY_CHARS = 4000;

        let currentHistoryChars = 0;
        const limitedHistory = [];
        // Traverse history backwards to keep most recent
        for (let i = history.length - 1; i >= 0; i--) {
            const entry = `${history[i].role}: ${history[i].text}`;
            if (currentHistoryChars + entry.length > MAX_HISTORY_CHARS) break;
            limitedHistory.unshift(entry);
            currentHistoryChars += entry.length;
        }

        let currentMemoryChars = 0;
        const limitedMemory = [];
        for (const m of retrievedMemory) {
            const entry = typeof m === 'string' ? m : JSON.stringify(m);
            if (currentMemoryChars + entry.length > MAX_MEMORY_CHARS) break;
            limitedMemory.push(entry);
            currentMemoryChars += entry.length;
        }

        return {
            history: limitedHistory,
            memory: limitedMemory,
            emotion,
            emotionState,
            personalityDirectives,
            currentTime: new Date().toISOString(),
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