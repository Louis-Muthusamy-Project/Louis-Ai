/**
 * ==========================================
 * SessionStore - Infrastructure Memory Store
 * ==========================================
 */
class SessionStore {
    constructor() {
        this.sessions = new Map();
    }

    get(socketId) {
        return this.sessions.get(socketId);
    }

    set(socketId, session) {
        this.sessions.set(socketId, session);
    }

    has(socketId) {
        return this.sessions.has(socketId);
    }

    delete(socketId) {
        return this.sessions.delete(socketId);
    }

    clear() {
        this.sessions.clear();
    }
}

module.exports = SessionStore;
