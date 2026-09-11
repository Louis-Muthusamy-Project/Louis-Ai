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
     * @param {{ name: string, email: string, passwordHash: string, role?: string, features?: object }} data
     * @returns {Promise<object>} the created user record INCLUDING passwordHash
     */
    async create(data) {
        throw new Error("Method not implemented.");
    }

    /**
     * @returns {Promise<object[]>} every user record INCLUDING passwordHash
     * (callers - e.g. admin controller - are responsible for stripping it
     * before it ever reaches a response).
     */
    async list() {
        throw new Error("Method not implemented.");
    }

    /**
     * @param {string} id
     * @param {{ chat?: boolean, character?: boolean, coding?: boolean }} features
     * @returns {Promise<object|null>} updated user record INCLUDING passwordHash
     */
    async updateFeatures(id, features) {
        throw new Error("Method not implemented.");
    }

    /**
     * @param {string} id
     * @param {string} role "user" | "super_admin"
     */
    async updateRole(id, role) {
        throw new Error("Method not implemented.");
    }

    /**
     * @param {string} id
     * @returns {Promise<boolean>} true if a user was deleted
     */
    async deleteById(id) {
        throw new Error("Method not implemented.");
    }

    /**
     * @param {string} id
     */
    async touchLastLogin(id) {
        throw new Error("Method not implemented.");
    }

    /**
     * @param {string} id
     * @param {string} passwordHash
     */
    async updatePasswordHash(id, passwordHash) {
        throw new Error("Method not implemented.");
    }
}

module.exports = UserRepository;
