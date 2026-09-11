const authService = require("../services/authService");
const Kernel = require("../core/Kernel");

function passwordResetService() {
    return Kernel.get("passwordResetService");
}

function sendAuthError(res, error) {
    // authService/authMiddleware attach status+code to expected errors.
    // Anything without those is unexpected - log it, but never leak
    // internals (stack trace, file paths) to the client.
    const status = error.status || 500;
    if (status >= 500) {
        console.error("[auth.controller] Unexpected error:", error);
    }
    return res.status(status).json({
        success: false,
        message: status >= 500 ? "Something went wrong. Please try again." : error.message,
        code: error.code || "INTERNAL_ERROR"
    });
}

async function signup(req, res) {
    try {
        const { name, email, password } = req.body || {};
        const { user, token } = await authService.signup({ name, email, password });
        return res.status(201).json({ success: true, user, token });
    } catch (error) {
        return sendAuthError(res, error);
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body || {};
        const { user, token } = await authService.login({ email, password });
        return res.status(200).json({ success: true, user, token });
    } catch (error) {
        return sendAuthError(res, error);
    }
}

async function me(req, res) {
    // requireAuth has already attached req.user
    return res.status(200).json({ success: true, user: req.user });
}

async function logout(req, res) {
    // Stateless JWT strategy (see Docs / final report): there is no
    // server-side session to invalidate. The client is responsible for
    // discarding the token; this endpoint exists so the frontend has a
    // single, explicit "logout" call and so a future token-blocklist
    // could be added here without changing the client contract.
    return res.status(200).json({ success: true, message: "Logged out." });
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Always 200 + generic message, regardless of whether the email exists.
 */
async function forgotPassword(req, res) {
    try {
        const { email } = req.body || {};
        const result = await passwordResetService().requestReset(email);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        // requestReset() itself never throws for "unknown email" - only
        // unexpected internal errors reach here.
        return sendAuthError(res, error);
    }
}

/**
 * POST /api/auth/verify-otp
 * Body: { email, otp }
 * Returns a short-lived resetToken required by /reset-password.
 */
async function verifyOtp(req, res) {
    try {
        const { email, otp } = req.body || {};
        const result = await passwordResetService().verifyOtp(email, otp);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return sendAuthError(res, error);
    }
}

/**
 * POST /api/auth/reset-password
 * Body: { email, resetToken, newPassword, confirmPassword }
 * Requires a resetToken from a successful /verify-otp call - an email
 * alone (without proving OTP ownership) can never reach this.
 */
async function resetPassword(req, res) {
    try {
        const { email, resetToken, newPassword, confirmPassword } = req.body || {};
        const result = await passwordResetService().resetPassword({ email, resetToken, newPassword, confirmPassword });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return sendAuthError(res, error);
    }
}

module.exports = { signup, login, me, logout, forgotPassword, verifyOtp, resetPassword };
