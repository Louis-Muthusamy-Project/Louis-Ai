const mongoose = require("mongoose");
const PasswordResetRepository = require("./PasswordResetRepository");
const PasswordResetToken = require("../models/PasswordResetToken");

class MongoPasswordResetRepository extends PasswordResetRepository {
    async upsertOtp(userId, { otpHash, otpExpiresAt }) {
        const doc = await PasswordResetToken.findOneAndUpdate(
            { userId },
            {
                $set: {
                    otpHash,
                    otpExpiresAt,
                    otpAttempts: 0,
                    otpUsed: false,
                    resetTokenHash: null,
                    resetTokenExpiresAt: null,
                    lastRequestedAt: new Date()
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).select("+otpHash +resetTokenHash").lean();
        return this._toPlain(doc);
    }

    async findByUserId(userId) {
        if (!mongoose.isValidObjectId(userId)) return null;
        const doc = await PasswordResetToken.findOne({ userId }).select("+otpHash +resetTokenHash").lean();
        return doc ? this._toPlain(doc) : null;
    }

    async incrementAttempts(userId) {
        const doc = await PasswordResetToken.findOneAndUpdate(
            { userId },
            { $inc: { otpAttempts: 1 } },
            { new: true }
        ).select("+otpHash +resetTokenHash").lean();
        return doc ? this._toPlain(doc) : null;
    }

    async markVerified(userId, { resetTokenHash, resetTokenExpiresAt }) {
        const doc = await PasswordResetToken.findOneAndUpdate(
            { userId },
            { $set: { otpUsed: true, resetTokenHash, resetTokenExpiresAt } },
            { new: true }
        ).select("+otpHash +resetTokenHash").lean();
        return doc ? this._toPlain(doc) : null;
    }

    async deleteByUserId(userId) {
        await PasswordResetToken.deleteOne({ userId });
        return true;
    }

    _toPlain(doc) {
        if (!doc) return null;
        return {
            userId: doc.userId.toString(),
            otpHash: doc.otpHash,
            otpExpiresAt: doc.otpExpiresAt,
            otpAttempts: doc.otpAttempts,
            otpUsed: doc.otpUsed,
            resetTokenHash: doc.resetTokenHash,
            resetTokenExpiresAt: doc.resetTokenExpiresAt
        };
    }
}

module.exports = MongoPasswordResetRepository;
