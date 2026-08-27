const fs = require("fs");
const path = require("path");

const MemoryRepository = require("./MemoryRepository");
const { sanitizeUserId } = require("../utils/idSanitize");

class FileMemoryRepository extends MemoryRepository {
    constructor() {
        super();
        this.dataRoot = path.join(__dirname, "..", "data", "users");
        this._locks = new Map(); // userId -> Promise chain
    }

    _userDir(userId) {
        return path.join(this.dataRoot, sanitizeUserId(userId));
    }

    _memoriesPath(userId) {
        return path.join(this._userDir(userId), "memories.json");
    }

    _profilePath(userId) {
        return path.join(this._userDir(userId), "profile.json");
    }

    _ensureDirExists(filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /** Serializes all read-modify-write operations for a single user. */
    _withUserLock(userId, fn) {
        const key = sanitizeUserId(userId);
        const previous = this._locks.get(key) || Promise.resolve();
        const next = previous.then(fn, fn);
        this._locks.set(key, next.catch(() => {}));
        return next;
    }

    _defaultProfile() {
        return {
            user: {
                name: "User",
                birthday: null,
                hobbies: [],
                job: null
            },
            preferences: {
                likes: [],
                dislikes: [],
                speechSpeed: "normal",
                topicsOfInterest: []
            },
            goals: [],
            projects: [],
            relationship: {
                level: 1,
                points: 0,
                firstInteraction: new Date().toISOString(),
                lastInteraction: new Date().toISOString(),
                interactionCount: 0
            },
            timeline: []
        };
    }

    async readMemories(userId) {
        const filePath = this._memoriesPath(userId);
        if (!fs.existsSync(filePath)) {
            return [];
        }
        try {
            const raw = fs.readFileSync(filePath, "utf8");
            return JSON.parse(raw);
        } catch (error) {
            console.error("[FileMemoryRepository] Error reading memories file:", error.message);
            return [];
        }
    }

    async writeMemories(userId, memories) {
        return this._withUserLock(userId, () => {
            try {
                const filePath = this._memoriesPath(userId);
                this._ensureDirExists(filePath);
                fs.writeFileSync(filePath, JSON.stringify(memories, null, 4), "utf8");
                return true;
            } catch (error) {
                console.error("[FileMemoryRepository] Error writing memories file:", error.message);
                return false;
            }
        });
    }

    async readProfile(userId) {
        const defaultProfile = this._defaultProfile();
        const filePath = this._profilePath(userId);

        if (!fs.existsSync(filePath)) {
            return defaultProfile;
        }
        try {
            const raw = fs.readFileSync(filePath, "utf8");
            return {
                ...defaultProfile,
                ...JSON.parse(raw)
            };
        } catch (error) {
            console.error("[FileMemoryRepository] Error reading profile file:", error.message);
            return defaultProfile;
        }
    }

    async writeProfile(userId, profile) {
        return this._withUserLock(userId, () => {
            try {
                const filePath = this._profilePath(userId);
                this._ensureDirExists(filePath);
                fs.writeFileSync(filePath, JSON.stringify(profile, null, 4), "utf8");
                return true;
            } catch (error) {
                console.error("[FileMemoryRepository] Error writing profile file:", error.message);
                return false;
            }
        });
    }
}

module.exports = FileMemoryRepository;