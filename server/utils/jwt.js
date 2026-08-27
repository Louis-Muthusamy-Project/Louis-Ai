const jwt = require("jsonwebtoken");

/**
 * ==========================================
 * JWT Utility
 * ------------------------------------------
 * Single source of truth for signing/verifying
 * access tokens. Used by:
 *   - server/services/authService.js (issuing tokens)
 *   - server/middleware/authMiddleware.js (HTTP)
 *   - server/config/socket.js (Socket.IO handshake)
 *
 * The token payload intentionally carries only the
 * user id (as `sub`). No email/name/roles are embedded
 * so nothing sensitive rides along with the token.
 * ==========================================
 */

function getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || !secret.trim()) {
        // Should never happen in practice: envValidator.js requires
        // JWT_SECRET at boot. This is a defensive guard for any code
        // path that imports this module before validation runs (e.g. tests).
        throw new Error("JWT_SECRET is not configured.");
    }
    return secret;
}

function getExpiresIn() {
    return process.env.JWT_EXPIRES_IN || "7d";
}

/**
 * Signs a new access token for the given user id.
 * @param {string} userId
 * @returns {string} signed JWT
 */
function signAccessToken(userId) {
    if (!userId) {
        throw new Error("Cannot sign a token without a user id.");
    }
    return jwt.sign(
        { sub: String(userId) },
        getSecret(),
        { expiresIn: getExpiresIn() }
    );
}

/**
 * Verifies a token and returns its decoded payload.
 * Throws (jsonwebtoken's own errors: TokenExpiredError, JsonWebTokenError) on failure.
 * @param {string} token
 * @returns {{ sub: string, iat: number, exp: number }}
 */
function verifyAccessToken(token) {
    return jwt.verify(token, getSecret());
}

module.exports = {
    signAccessToken,
    verifyAccessToken
};
