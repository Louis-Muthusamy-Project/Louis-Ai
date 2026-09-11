const express = require("express");
const rateLimit = require("express-rate-limit");

const { signup, login, me, logout, forgotPassword, verifyOtp, resetPassword } = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * Stricter limiter for credential endpoints only (brute-force protection).
 * The global limiter in config/server.js (100 req / 15 min) already covers
 * the whole API; this tightens just /signup and /login without making
 * local development painful.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many attempts. Please try again later.",
        code: "RATE_LIMITED"
    }
});

// Forgot-password request/resend limiter - tighter than login since a
// successful request sends a real email (Part 2: "resend rate limiting"
// and "request rate limiting").
const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later.",
        code: "RATE_LIMITED"
    }
});

// OTP verification limiter - separate from the service-level per-OTP
// attempt counter (which survives across requests); this just stops
// someone hammering the endpoint itself.
const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many attempts. Please try again later.",
        code: "RATE_LIMITED"
    }
});

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.get("/me", requireAuth, me);
router.post("/logout", requireAuth, logout);

router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/verify-otp", otpVerifyLimiter, verifyOtp);
router.post("/reset-password", otpVerifyLimiter, resetPassword);

module.exports = router;
