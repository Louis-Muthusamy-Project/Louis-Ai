const fs = require("fs");
const path = require("path");

const CodingSessionRepository = require("./CodingSessionRepository");
const { sanitizeUserId } = require("../utils/idSanitize");

class FileCodingSessionRepository extends CodingSessionRepository {
    constructor() {
        super();
        this.dataRoot = path.join(__dirname, "..", "data", "users");
        this._locks = new Map(); // userId -> Promise chain, same pattern as FileMemoryRepository
    }

    _userSessionsDir(userId) {
        return path.join(this.dataRoot, sanitizeUserId(userId), "coding-sessions");
    }

    _sessionPath(userId, sessionId) {
        // sessionId is always a crypto.randomUUID() generated server-side
        // (see CodingAgentRuntime) - never taken from client input, but
        // sanitized anyway since it becomes part of a filesystem path.
        const safeId = String(sessionId).replace(/[^a-zA-Z0-9-]/g, "");
        return path.join(this._userSessionsDir(userId), `${safeId}.json`);
    }

    _withUserLock(userId, fn) {
        const key = sanitizeUserId(userId);
        const previous = this._locks.get(key) || Promise.resolve();
        const next = previous.then(fn, fn);
        this._locks.set(key, next.catch(() => {}));
        return next;
    }

    async save(record) {
        return this._withUserLock(record.userId, async () => {
            const dir = this._userSessionsDir(record.userId);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this._sessionPath(record.userId, record.sessionId), JSON.stringify(record, null, 2), "utf8");
            return record;
        });
    }

    async get(sessionId) {
        // File storage is keyed by userId first (like every other
        // per-user file store in this app), so a lookup by sessionId
        // alone has to scan each user's coding-sessions directory. This
        // is bounded by the number of local users (this is a
        // single-desktop-app data store, not a multi-tenant server DB),
        // so a scan is acceptable - see MongoCodingSessionRepository for
        // the indexed equivalent used when USE_MONGO is enabled.
        if (!fs.existsSync(this.dataRoot)) return null;
        const safeId = String(sessionId).replace(/[^a-zA-Z0-9-]/g, "");
        for (const userDir of fs.readdirSync(this.dataRoot, { withFileTypes: true })) {
            if (!userDir.isDirectory()) continue;
            const candidate = path.join(this.dataRoot, userDir.name, "coding-sessions", `${safeId}.json`);
            if (fs.existsSync(candidate)) {
                return JSON.parse(fs.readFileSync(candidate, "utf8"));
            }
        }
        return null;
    }

    async listForUser(userId, { limit = 50 } = {}) {
        const dir = this._userSessionsDir(userId);
        if (!fs.existsSync(dir)) return [];
        const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
        const records = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
        records.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        return records.slice(0, limit);
    }
}

module.exports = FileCodingSessionRepository;
