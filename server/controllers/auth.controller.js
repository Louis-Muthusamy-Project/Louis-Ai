const authService = require("../services/authService");

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

module.exports = { signup, login, me, logout };
