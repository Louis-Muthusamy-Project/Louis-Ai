/**
 * ==========================================
 * PasswordResetRepository - Base Interface
 * ==========================================
 * One record per user. Only ever stores hashes of the
 * OTP / reset-session token, never plaintext.
 */
class PasswordResetRepository {
    /**
     * Creates or replaces the single reset record for a user.
     * @param {string} userId
     * @param {{ otpHash: string, otpExpiresAt: Date }} data
     */
    async upsertOtp(userId, data) {
        throw new Error("Method not implemented.");
    }

    /** @returns {Promise<object|null>} record INCLUDING otpHash/resetTokenHash */
    async findByUserId(userId) {
        throw new Error("Method not implemented.");
    }

    async incrementAttempts(userId) {
        throw new Error("Method not implemented.");
    }

    /**
     * Marks the OTP as used and stores the (hashed) reset-session token
     * that authorizes the subsequent reset-password call.
     */
    async markVerified(userId, { resetTokenHash, resetTokenExpiresAt }) {
        throw new Error("Method not implemented.");
    }

    /** Deletes the record entirely (after a successful reset, or superseded by a new request). */
    async deleteByUserId(userId) {
        throw new Error("Method not implemented.");
    }
}

module.exports = PasswordResetRepository;
