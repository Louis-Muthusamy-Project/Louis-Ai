const { verifyAccessToken } = require("../utils/jwt");
const authService = require("../services/authService");

/**
 * ==========================================
 * requireAuth
 * ------------------------------------------
 * Verifies the `Authorization: Bearer <token>` header and
 * attaches the authenticated user to req.user.
 *
 * Identity ALWAYS comes from the verified JWT's `sub`
 * claim - never from req.body.userId / req.query.userId,
 * which this middleware deliberately never reads.
 * ==========================================
 */
async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization || "";
        const [scheme, token] = header.split(" ");

        if (scheme !== "Bearer" || !token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
                code: "NO_TOKEN"
            });
        }

        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch (error) {
            const code = error.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN";
            return res.status(401).json({
                success: false,
                message: "Your session has expired or is invalid. Please log in again.",
                code
            });
        }

        const user = await authService.getUserById(decoded.sub);
        req.user = user; // { id, name, email, createdAt, updatedAt } - never passwordHash

        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Authentication required.",
            code: "NO_TOKEN"
        });
    }
}

module.exports = { requireAuth };
