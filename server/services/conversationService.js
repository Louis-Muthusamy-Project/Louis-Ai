const Session = require("../domain/Session");
const Kernel = require("../core/Kernel");

const MAX_HISTORY = 30;

/**
 * ==========================================
 * ConversationService - Refactored Service Class
 * ==========================================
 */
class ConversationService {
    constructor(kernel) {
        this.kernel = kernel;
        // Lazily fetch sessionStore from kernel
    }

    get store() {
        return this.kernel.get("sessionStore");
    }

    createSession(socketId) {
        if (this.store.has(socketId)) {
            return this.store.get(socketId);
        }

        const session = new Session(socketId);
        this.store.set(socketId, session);
        return session;
    }

    getSession(socketId) {
        return this.createSession(socketId);
    }

    addUserMessage(socketId, text) {
        const session = this.createSession(socketId);
        session.addMessage("user", text);
        session.trim(MAX_HISTORY);
    }

    addAssistantMessage(socketId, text) {
        const session = this.createSession(socketId);
        session.addMessage("assistant", text);
        session.trim(MAX_HISTORY);
    }

    getHistory(socketId) {
        const session = this.createSession(socketId);
        return session.getHistory();
    }

    clearSession(socketId) {
        this.store.delete(socketId);
    }

    sessionInfo(socketId) {
        const session = this.createSession(socketId);
        return {
            id: session.id,
            totalMessages: session.messages.length,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
        };
    }
}

// Module export adapter to maintain exact backward compatibility
const service = new ConversationService(Kernel);

module.exports = {
    ConversationService, // Export class for DI registration
    createSession: (s) => service.createSession(s),
    getSession: (s) => service.getSession(s),
    getHistory: (s) => service.getHistory(s),
    addUserMessage: (s, t) => service.addUserMessage(s, t),
    addAssistantMessage: (s, t) => service.addAssistantMessage(s, t),
    clearSession: (s) => service.clearSession(s),
    sessionInfo: (s) => service.sessionInfo(s)
};