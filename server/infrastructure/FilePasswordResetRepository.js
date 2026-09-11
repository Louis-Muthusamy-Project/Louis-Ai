const fs = require("fs");
const path = require("path");

const PasswordResetRepository = require("./PasswordResetRepository");

/**
 * ==========================================
 * FilePasswordResetRepository - Local Fallback
 * ------------------------------------------
 * Mirrors FileUserRepository's pattern: one JSON file
 * under the already-gitignored server/data/ directory,
 * one record per user, keyed by userId.
 * ==========================================
 */
class FilePasswordResetRepository extends PasswordResetRepository {
    constructor() {
        super();
        this.filePath = path.join(__dirname, "..", "data", "password-resets.json");
        this._writeQueue = Promise.resolve();
    }

    _ensureDirExists() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    _readAll() {
        if (!fs.existsSync(this.filePath)) return [];
        try {
            const raw = fs.readFileSync(this.filePath, "utf8");
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("[FilePasswordResetRepository] Error reading file:", error.message);
            return [];
        }
    }

    _writeAll(records) {
        this._ensureDirExists();
        const tmpPath = `${this.filePath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(records, null, 4), "utf8");
        fs.renameSync(tmpPath, this.filePath);
    }

    _withLock(fn) {
        const run = () => fn(this._readAll());
        const next = this._writeQueue.then(run, run);
        this._writeQueue = next.catch(() => {});
        return next;
    }

    async upsertOtp(userId, { otpHash, otpExpiresAt }) {
        return this._withLock((records) => {
            const filtered = records.filter(r => r.userId !== userId);
            const record = {
                userId,
                otpHash,
                otpExpiresAt: otpExpiresAt.toISOString(),
                otpAttempts: 0,
                otpUsed: false,
                resetTokenHash: null,
                resetTokenExpiresAt: null,
                lastRequestedAt: new Date().toISOString()
            };
            filtered.push(record);
            this._writeAll(filtered);
            return record;
        });
    }

    async findByUserId(userId) {
        const records = this._readAll();
        return records.find(r => r.userId === userId) || null;
    }

    async incrementAttempts(userId) {
        return this._withLock((records) => {
            const index = records.findIndex(r => r.userId === userId);
            if (index === -1) return null;
            records[index] = { ...records[index], otpAttempts: (records[index].otpAttempts || 0) + 1 };
            this._writeAll(records);
            return records[index];
        });
    }

    async markVerified(userId, { resetTokenHash, resetTokenExpiresAt }) {
        return this._withLock((records) => {
            const index = records.findIndex(r => r.userId === userId);
            if (index === -1) return null;
            records[index] = {
                ...records[index],
                otpUsed: true,
                resetTokenHash,
                resetTokenExpiresAt: resetTokenExpiresAt.toISOString()
            };
            this._writeAll(records);
            return records[index];
        });
    }

    async deleteByUserId(userId) {
        return this._withLock((records) => {
            const filtered = records.filter(r => r.userId !== userId);
            this._writeAll(filtered);
            return true;
        });
    }
}

module.exports = FilePasswordResetRepository;
