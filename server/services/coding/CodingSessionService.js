/**
 * ==========================================
 * CodingSessionService
 * ------------------------------------------
 * Thin ownership-enforcing wrapper around a CodingSessionRepository
 * (file or Mongo, selected the same way as memoryService/scheduleService -
 * see bootstrap.js). CodingAgentRuntime writes through this on every
 * meaningful state change; the capability/socket layer reads through this
 * too, never the raw repository directly - that's what guarantees a
 * lookup by a bare sessionId can never leak another user's session, since
 * every read here re-checks record.userId === the authenticated caller's
 * userId and returns null (not an error revealing existence) on mismatch.
 * ==========================================
 */
class CodingSessionService {
    constructor(repository) {
        this.repository = repository;
    }

    async save(record) {
        return this.repository.save(record);
    }

    /**
     * @returns {object|null} the record if it exists AND belongs to userId,
     * null otherwise - a mismatch is indistinguishable from "not found" to
     * the caller, so probing for other users' session ids gains nothing.
     */
    async getOwned(userId, sessionId) {
        if (!userId || !sessionId) return null;
        const record = await this.repository.get(sessionId);
        if (!record || record.userId !== userId) return null;
        return record;
    }

    async listForUser(userId, options = {}) {
        if (!userId) return [];
        return this.repository.listForUser(userId, options);
    }
}

module.exports = CodingSessionService;
