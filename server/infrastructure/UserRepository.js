/**
 * ==========================================
 * UserRepository - Base Interface
 * ==========================================
 * Mirrors the existing MemoryRepository interface so
 * authService doesn't need to know whether users are
 * backed by Mongo or a local JSON file.
 */
class UserRepository {
    async initialize() {
        // Setup connections if needed
    }

    /**
     * @param {string} email already normalized (lowercase/trimmed)
     * @returns {Promise<object|null>} user record INCLUDING passwordHash, or null
     */
    async findByEmail(email) {
        throw new Error("Method not implemented.");
    }

    /**
     * @param {string} id
     * @returns {Promise<object|null>} user record INCLUDING passwordHash, or null
     */
    async findById(id) {
        throw new Error("Method not implemented.");
    }

    /**
     * @param {{ name: string, email: string, passwordHash: string }} data
     * @returns {Promise<object>} the created user record INCLUDING passwordHash
     */
    async create(data) {
        throw new Error("Method not implemented.");
    }
}

module.exports = UserRepository;
