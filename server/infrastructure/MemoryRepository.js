
class MemoryRepository {
    async initialize() {
        // Setup connections if needed
    }

    async readMemories(userId) {
        throw new Error("Method not implemented.");
    }

    async writeMemories(userId, memories) {
        throw new Error("Method not implemented.");
    }

    async readProfile(userId) {
        throw new Error("Method not implemented.");
    }

    async writeProfile(userId, profile) {
        throw new Error("Method not implemented.");
    }
}

module.exports = MemoryRepository;