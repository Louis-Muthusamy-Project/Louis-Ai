const mongoose = require("mongoose");
const UserRepository = require("./UserRepository");
const User = require("../models/User");
const { DEFAULT_FEATURES, ROLES } = require("../config/roles");

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

    async create({ name, email, passwordHash, role, features }) {
        try {
            const doc = await User.create({
                name,
                email,
                passwordHash,
                role: role || ROLES.USER,
                features: { ...DEFAULT_FEATURES, ...(features || {}) }
            });
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

    async list() {
        const docs = await User.find({}).select("+passwordHash").lean();
        return docs.map(doc => this._toPlain(doc));
    }

    async updateFeatures(id, features) {
        if (!mongoose.isValidObjectId(id)) return null;
        const doc = await User.findByIdAndUpdate(
            id,
            { $set: Object.fromEntries(Object.entries(features).map(([k, v]) => [`features.${k}`, v])) },
            { new: true }
        ).select("+passwordHash").lean();
        return doc ? this._toPlain(doc) : null;
    }

    async updateRole(id, role) {
        if (!mongoose.isValidObjectId(id)) return null;
        const doc = await User.findByIdAndUpdate(id, { $set: { role } }, { new: true })
            .select("+passwordHash").lean();
        return doc ? this._toPlain(doc) : null;
    }

    async deleteById(id) {
        if (!mongoose.isValidObjectId(id)) return false;
        const result = await User.deleteOne({ _id: id });
        return result.deletedCount > 0;
    }

    async touchLastLogin(id) {
        if (!mongoose.isValidObjectId(id)) return null;
        const doc = await User.findByIdAndUpdate(id, { $set: { lastLoginAt: new Date() } }, { new: true })
            .select("+passwordHash").lean();
        return doc ? this._toPlain(doc) : null;
    }

    async updatePasswordHash(id, passwordHash) {
        if (!mongoose.isValidObjectId(id)) return null;
        const doc = await User.findByIdAndUpdate(id, { $set: { passwordHash } }, { new: true })
            .select("+passwordHash").lean();
        return doc ? this._toPlain(doc) : null;
    }

    _toPlain(doc) {
        return {
            id: doc._id.toString(),
            name: doc.name,
            email: doc.email,
            passwordHash: doc.passwordHash,
            // .lean() bypasses Mongoose schema defaults, so legacy documents
            // written before role/features existed need the same safe
            // backfill the FileUserRepository does (Part 15 - Data Migration).
            role: doc.role || ROLES.USER,
            status: doc.status || "active",
            features: { ...DEFAULT_FEATURES, ...(doc.features || {}) },
            lastLoginAt: doc.lastLoginAt || null,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    }
}

module.exports = MongoUserRepository;
