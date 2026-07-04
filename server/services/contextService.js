const MemoryService = require("./memoryService");
const {
    getHistory
} = require("./conversationService");

class ContextService {

    build(socketId, options = {}) {

        const {

            emotion = "neutral",

            userMessage = "",

            userProfile = {},

            desktopState = {}

        } = options;

        const history = getHistory(socketId);

        const memory = MemoryService
            .getSummary(socketId)
            .map(item => `${item.role}: ${item.text}`);

        return {

            history,

            memory,

            emotion,

            currentTime: new Date(),

            userMessage,

            userProfile,

            desktopState

        };

    }

}

module.exports = new ContextService();