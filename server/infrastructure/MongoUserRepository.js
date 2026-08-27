const mongoose = require("mongoose");
const UserRepository = require("./UserRepository");
const User = require("../models/User");

/**
 * ==========================================
 * MongoUserRepository
 * ==========================================
 * Note: this class does NOT open its own connection.
 * MongoMemoryRepository.initialize() (called from
 * bootstrap.js) already establishes the shared mongoose
 * connection, and Mongo/Mongoose connections are
 * process-wide singletons - opening a second one here
 * would be redundant and could race with it.
 */
class MongoUserRepository extends UserRepository {
    async findByEmail(email) {
        const doc = await User.findOne({ email }).select("+passwordHash").lean();
        return doc ? this._toPlain(doc) : null;
    }

    async findById(id) {
        if (!mongoose.isValidObjectId(id)) return null;
        const doc = await User.findById(id).select("+passwordHash").lean();
        return doc ? this._toPlain(doc) : null;
    }

    async create({ name, email, passwordHash }) {
        try {
            const doc = await User.create({ name, email, passwordHash });
            return this._toPlain(doc.toObject());
        } catch (error) {
            if (error.code === 11000) {
                // Duplicate key on the unique `email` index.
                const dupError = new Error("An account with this email already exists.");
                dupError.code = "EMAIL_TAKEN";
                throw dupError;
            }
            throw error;
        }
    }

    _toPlain(doc) {
        return {
            id: doc._id.toString(),
            name: doc.name,
            email: doc.email,
            passwordHash: doc.passwordHash,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    }
}

module.exports = MongoUserRepository;
