const express = require("express");
const rateLimit = require("express-rate-limit");

const { signup, login, me, logout } = require("../controllers/auth.controller");
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

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.get("/me", requireAuth, me);
router.post("/logout", requireAuth, logout);

module.exports = router;
