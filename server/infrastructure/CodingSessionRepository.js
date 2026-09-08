class CodingSessionRepository {
    async initialize() {
        // Setup connections if needed
    }

    /** Creates or fully overwrites a session record. */
    async save(record) {
        throw new Error("Method not implemented.");
    }

    /** @returns {object|null} the record, or null if not found. */
    async get(sessionId) {
        throw new Error("Method not implemented.");
    }

    /** Lists session summaries for one user, most recent first. */
    async listForUser(userId, { limit = 50 } = {}) {
        throw new Error("Method not implemented.");
    }
}

module.exports = CodingSessionRepository;
