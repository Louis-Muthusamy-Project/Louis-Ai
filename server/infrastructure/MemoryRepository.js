/**
 * ==========================================
 * MemoryRepository - Base Interface
 * ==========================================
 */
class MemoryRepository {
    async initialize() {
        // Setup connections if needed
    }

    async readMemories() {
        throw new Error("Method not implemented.");
    }

    async writeMemories(memories) {
        throw new Error("Method not implemented.");
    }

    async readProfile() {
        throw new Error("Method not implemented.");
    }

    async writeProfile(profile) {
        throw new Error("Method not implemented.");
    }
}

module.exports = MemoryRepository;
