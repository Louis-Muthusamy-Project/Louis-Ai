const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UserRepository = require("./UserRepository");
const { DEFAULT_FEATURES, ROLES } = require("../config/roles");

/**
 * ==========================================
 * FileUserRepository - Local Fallback
 * ------------------------------------------
 * Stores a single JSON array of users at
 * server/data/users.json. This directory is already
 * gitignored (server/data/) so it never gets committed.
 *
 * This is intentionally simple (desktop/local-demo auth,
 * not a real multi-tenant user store): one flat file,
 * one lightweight in-process write lock to avoid
 * read-modify-write races between concurrent signups.
 * ==========================================
 */
class FileUserRepository extends UserRepository {
    constructor() {
        super();
        this.filePath = path.join(__dirname, "..", "data", "users.json");
        // Serializes writes so two concurrent signups can't clobber each other.
        this._writeQueue = Promise.resolve();
    }

    _ensureDirExists() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    _readAll() {
        if (!fs.existsSync(this.filePath)) {
            return [];
        }
        try {
            const raw = fs.readFileSync(this.filePath, "utf8");
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("[FileUserRepository] Error reading users file:", error.message);
            return [];
        }
    }

    _writeAll(users) {
        this._ensureDirExists();
        // Write to a temp file then rename - avoids a half-written users.json
        // if the process is killed mid-write.
        const tmpPath = `${this.filePath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(users, null, 4), "utf8");
        fs.renameSync(tmpPath, this.filePath);
    }

    /**
     * Runs `fn` (sync) with exclusive access to the users file.
     */
    _withLock(fn) {
        const run = () => {
            const users = this._readAll();
            const result = fn(users);
            return result;
        };

        const next = this._writeQueue.then(run, run);
        // Keep the chain alive even if this operation throws, so later
        // operations still run in order.
        this._writeQueue = next.catch(() => {});
        return next;
    }

    /**
     * Backfills defaults for legacy records written before role/features
     * existed (Part 15 - Data Migration). Never overwrites an explicitly
     * stored value, only fills in what's missing.
     */
    _withDefaults(user) {
        if (!user) return user;
        return {
            role: ROLES.USER,
            status: "active",
            features: { ...DEFAULT_FEATURES },
            lastLoginAt: null,
            ...user,
            features: { ...DEFAULT_FEATURES, ...(user.features || {}) }
        };
    }

    async findByEmail(email) {
        const users = this._readAll();
        return this._withDefaults(users.find(u => u.email === email)) || null;
    }

    async findById(id) {
        const users = this._readAll();
        return this._withDefaults(users.find(u => u.id === id)) || null;
    }

    async create({ name, email, passwordHash, role, features }) {
        return this._withLock((users) => {
            if (users.some(u => u.email === email)) {
                // authService already checks this, but guard here too in case
                // of a race between two concurrent signups for the same email.
                const error = new Error("An account with this email already exists.");
                error.code = "EMAIL_TAKEN";
                throw error;
            }

            const now = new Date().toISOString();
            const user = {
                id: crypto.randomUUID(),
                name,
                email,
                passwordHash,
                role: role || ROLES.USER,
                status: "active",
                features: { ...DEFAULT_FEATURES, ...(features || {}) },
                lastLoginAt: null,
                createdAt: now,
                updatedAt: now
            };

            users.push(user);
            this._writeAll(users);
            return user;
        });
    }

    async list() {
        const users = this._readAll();
        return users.map(u => this._withDefaults(u));
    }

    async updateFeatures(id, features) {
        return this._withLock((users) => {
            const index = users.findIndex(u => u.id === id);
            if (index === -1) return null;

            users[index] = {
                ...this._withDefaults(users[index]),
                features: { ...this._withDefaults(users[index]).features, ...features },
                updatedAt: new Date().toISOString()
            };
            this._writeAll(users);
            return users[index];
        });
    }

    async updateRole(id, role) {
        return this._withLock((users) => {
            const index = users.findIndex(u => u.id === id);
            if (index === -1) return null;
            users[index] = { ...users[index], role, updatedAt: new Date().toISOString() };
            this._writeAll(users);
            return users[index];
        });
    }

    async deleteById(id) {
        return this._withLock((users) => {
            const index = users.findIndex(u => u.id === id);
            if (index === -1) return false;
            users.splice(index, 1);
            this._writeAll(users);
            return true;
        });
    }

    async touchLastLogin(id) {
        return this._withLock((users) => {
            const index = users.findIndex(u => u.id === id);
            if (index === -1) return null;
            users[index] = { ...users[index], lastLoginAt: new Date().toISOString() };
            this._writeAll(users);
            return users[index];
        });
    }

    async updatePasswordHash(id, passwordHash) {
        return this._withLock((users) => {
            const index = users.findIndex(u => u.id === id);
            if (index === -1) return null;
            users[index] = {
                ...users[index],
                passwordHash,
                updatedAt: new Date().toISOString()
            };
            this._writeAll(users);
            return users[index];
        });
    }
}

module.exports = FileUserRepository;
