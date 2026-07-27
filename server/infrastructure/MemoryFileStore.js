const fs = require("fs");
const path = require("path");

/**
 * ==========================================
 * MemoryFileStore - Infrastructure Adapter
 * ==========================================
 */
class MemoryFileStore {
    constructor() {
        this.memoriesPath = path.join(__dirname, "..", "data", "memories.json");
        this.profilePath = path.join(__dirname, "..", "data", "profile.json");
    }

    /**
     * Reads all long-term memory records from disk.
     */
    readMemories() {
        if (!fs.existsSync(this.memoriesPath)) {
            return [];
        }
        try {
            const raw = fs.readFileSync(this.memoriesPath, "utf8");
            return JSON.parse(raw);
        } catch (error) {
            console.error("[MemoryFileStore] Error reading memories file:", error);
            return [];
        }
    }

    /**
     * Writes all long-term memories to disk.
     */
    writeMemories(memories) {
        try {
            this.ensureDirExists(this.memoriesPath);
            fs.writeFileSync(this.memoriesPath, JSON.stringify(memories, null, 4), "utf8");
            return true;
        } catch (error) {
            console.error("[MemoryFileStore] Error writing memories file:", error);
            return false;
        }
    }

    /**
     * Reads the structured user profile / preferences / relationship status from disk.
     */
    readProfile() {
        const defaultProfile = {
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

        if (!fs.existsSync(this.profilePath)) {
            return defaultProfile;
        }
        try {
            const raw = fs.readFileSync(this.profilePath, "utf8");
            return {
                ...defaultProfile,
                ...JSON.parse(raw)
            };
        } catch (error) {
            console.error("[MemoryFileStore] Error reading profile file:", error);
            return defaultProfile;
        }
    }

    /**
     * Writes the structured user profile to disk.
     */
    writeProfile(profile) {
        try {
            this.ensureDirExists(this.profilePath);
            fs.writeFileSync(this.profilePath, JSON.stringify(profile, null, 4), "utf8");
            return true;
        } catch (error) {
            console.error("[MemoryFileStore] Error writing profile file:", error);
            return false;
        }
    }

    /**
     * Ensures directory structure for the target file exists.
     */
    ensureDirExists(filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

module.exports = MemoryFileStore;
