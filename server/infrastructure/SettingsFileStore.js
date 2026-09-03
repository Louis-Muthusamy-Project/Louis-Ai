const fs = require("fs");
const path = require("path");

const { sanitizeUserId } = require("../utils/idSanitize");

/**
 * ==========================================
 * SettingsFileStore - Infrastructure Adapter
 * ------------------------------------------
 * Per-user settings storage, mirroring the FileMemoryRepository
 * layout: server/data/users/<userId>/settings.json.
 *
 * Legacy (pre-isolation) global settings lived at
 * server/data/settings.json. On first read for the FIRST user who
 * has no per-user settings file yet, that legacy file is migrated
 * in (copied, then renamed to settings.json.migrated so it is never
 * re-applied). This preserves existing single-user data instead of
 * silently discarding it, without exposing it to every user.
 * ==========================================
 */
class SettingsFileStore {
    constructor() {
        this.dataRoot = path.join(__dirname, "..", "data", "users");
        this.legacyPath = path.join(__dirname, "..", "data", "settings.json");
        this._locks = new Map(); // userId -> Promise chain
    }

    _userDir(userId) {
        return path.join(this.dataRoot, sanitizeUserId(userId));
    }

    _filePath(userId) {
        return path.join(this._userDir(userId), "settings.json");
    }

    _ensureDirExists(filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    _withUserLock(userId, fn) {
        const key = sanitizeUserId(userId);
        const previous = this._locks.get(key) || Promise.resolve();
        const next = previous.then(fn, fn);
        this._locks.set(key, next.catch(() => {}));
        return next;
    }

    /** One-time, best-effort migration of the old global settings file. */
    _tryMigrateLegacy(filePath) {
        try {
            if (fs.existsSync(this.legacyPath) && !fs.existsSync(filePath)) {
                this._ensureDirExists(filePath);
                fs.copyFileSync(this.legacyPath, filePath);
                fs.renameSync(this.legacyPath, `${this.legacyPath}.migrated`);
                console.log(`[SettingsFileStore] Migrated legacy global settings.json to ${filePath}`);
            }
        } catch (error) {
            // Migration is best-effort - never block a read/write on it.
            console.error("[SettingsFileStore] Legacy settings migration skipped:", error.message);
        }
    }

    read(userId) {
        const filePath = this._filePath(userId);
        this._tryMigrateLegacy(filePath);

        if (!fs.existsSync(filePath)) {
            return {};
        }
        try {
            const raw = fs.readFileSync(filePath, "utf8");
            return JSON.parse(raw);
        } catch (error) {
            console.error("[SettingsFileStore] Error reading settings file:", error.message);
            return {};
        }
    }

    write(userId, data) {
        return this._withUserLock(userId, () => {
            try {
                const filePath = this._filePath(userId);
                this._ensureDirExists(filePath);
                fs.writeFileSync(filePath, JSON.stringify(data, null, 4), "utf8");
                return true;
            } catch (error) {
                console.error("[SettingsFileStore] Error writing settings file:", error.message);
                return false;
            }
        });
    }
}

module.exports = SettingsFileStore;
