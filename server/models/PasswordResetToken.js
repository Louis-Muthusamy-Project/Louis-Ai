const mongoose = require("mongoose");

/**
 * ==========================================
 * PasswordResetToken Model (Mongo)
 * ------------------------------------------
 * Never stores the OTP or the reset-session token in
 * plaintext - only a SHA-256 hash of each. One document
 * per user (upserted) so a new request supersedes any
 * previous unused OTP.
 * ==========================================
 */
const PasswordResetTokenSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true
        },
        otpHash: { type: String, required: true, select: false },
        otpExpiresAt: { type: Date, required: true },
        otpAttempts: { type: Number, default: 0 },
        otpUsed: { type: Boolean, default: false },
        resetTokenHash: { type: String, default: null, select: false },
        resetTokenExpiresAt: { type: Date, default: null },
        lastRequestedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

module.exports = mongoose.models.PasswordResetToken || mongoose.model("PasswordResetToken", PasswordResetTokenSchema);
