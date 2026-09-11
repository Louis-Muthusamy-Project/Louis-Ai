import apiClient from "./apiClient";

/**
 * ==========================================
 * authService (frontend)
 * ------------------------------------------
 * Thin wrapper around the /api/auth endpoints. Auth errors
 * from the backend already carry a `message`/`code` shape
 * (see server/controllers/auth.controller.js) - this just
 * normalizes network failures (no response at all) into the
 * same shape so callers only ever handle one error format.
 * ==========================================
 */

function normalizeError(error) {
    if (error.response && error.response.data) {
        return error.response.data; // { success: false, message, code }
    }
    return {
        success: false,
        message: "Could not reach the server. Please check your connection.",
        code: "NETWORK_ERROR"
    };
}

async function signup({ name, email, password }) {
    try {
        const { data } = await apiClient.post("/auth/signup", { name, email, password });
        return data; // { success, user, token }
    } catch (error) {
        throw normalizeError(error);
    }
}

async function login({ email, password }) {
    try {
        const { data } = await apiClient.post("/auth/login", { email, password });
        return data; // { success, user, token }
    } catch (error) {
        throw normalizeError(error);
    }
}

async function me() {
    try {
        const { data } = await apiClient.get("/auth/me");
        return data; // { success, user }
    } catch (error) {
        throw normalizeError(error);
    }
}

async function logout() {
    try {
        await apiClient.post("/auth/logout");
    } catch {
        // Logout is best-effort server-side (stateless JWT - see report);
        // the client clears its own state regardless of this call's outcome.
    }
}

async function forgotPassword(email) {
    try {
        const { data } = await apiClient.post("/auth/forgot-password", { email });
        return data; // { success, message } - always this generic shape
    } catch (error) {
        throw normalizeError(error);
    }
}

async function verifyOtp({ email, otp }) {
    try {
        const { data } = await apiClient.post("/auth/verify-otp", { email, otp });
        return data; // { success, resetToken, expiresInMinutes }
    } catch (error) {
        throw normalizeError(error);
    }
}

async function resetPassword({ email, resetToken, newPassword, confirmPassword }) {
    try {
        const { data } = await apiClient.post("/auth/reset-password", { email, resetToken, newPassword, confirmPassword });
        return data; // { success }
    } catch (error) {
        throw normalizeError(error);
    }
}

export default { signup, login, me, logout, forgotPassword, verifyOtp, resetPassword };
