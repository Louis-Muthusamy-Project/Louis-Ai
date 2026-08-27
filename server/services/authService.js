const bcrypt = require("bcryptjs");

const Kernel = require("../core/Kernel");
const { signAccessToken } = require("../utils/jwt");

const MIN_PASSWORD_LENGTH = 8;
const SALT_ROUNDS = 12;

/**
 * ==========================================
 * AuthService
 * ------------------------------------------
 * Owns password hashing, credential checks, and token
 * issuing. Controllers should never touch bcrypt/jwt or
 * the user repository directly - go through here so
 * there's exactly one place that knows how a password
 * is verified and how a token is minted.
 * ==========================================
 */
class AuthService {
    constructor(kernel) {
        this.kernel = kernel;
    }

    get userRepository() {
        return this.kernel.get("userRepository");
    }

    _normalizeEmail(email) {
        return typeof email === "string" ? email.trim().toLowerCase() : "";
    }

    _validateSignupInput({ name, email, password }) {
        const errors = [];

        if (!name || typeof name !== "string" || !name.trim()) {
            errors.push("Name is required.");
        }

        const normalizedEmail = this._normalizeEmail(email);
        if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            errors.push("A valid email is required.");
        }

        if (!password || typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
            errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        }

        if (errors.length > 0) {
            const error = new Error(errors.join(" "));
            error.status = 400;
            error.code = "VALIDATION_ERROR";
            throw error;
        }

        return { name: name.trim(), email: normalizedEmail, password };
    }

    /** Strips passwordHash before a user record ever leaves this service. */
    _toSafeUser(user) {
        if (!user) return null;
        const { passwordHash, ...safe } = user;
        return safe;
    }

    async signup({ name, email, password }) {
        const clean = this._validateSignupInput({ name, email, password });

        const existing = await this.userRepository.findByEmail(clean.email);
        if (existing) {
            const error = new Error("An account with this email already exists.");
            error.status = 409;
            error.code = "EMAIL_TAKEN";
            throw error;
        }

        const passwordHash = await bcrypt.hash(clean.password, SALT_ROUNDS);

        let created;
        try {
            created = await this.userRepository.create({
                name: clean.name,
                email: clean.email,
                passwordHash
            });
        } catch (error) {
            if (error.code === "EMAIL_TAKEN") {
                error.status = 409;
            }
            throw error;
        }

        const token = signAccessToken(created.id);
        return { user: this._toSafeUser(created), token };
    }

    async login({ email, password }) {
        const normalizedEmail = this._normalizeEmail(email);

        if (!normalizedEmail || !password) {
            const error = new Error("Invalid email or password.");
            error.status = 400;
            error.code = "VALIDATION_ERROR";
            throw error;
        }

        const user = await this.userRepository.findByEmail(normalizedEmail);

        // Generic message for both "no such user" and "wrong password" -
        // never reveal which one it was (Phase 12 requirement).
        const invalidCredentialsError = () => {
            const error = new Error("Invalid email or password.");
            error.status = 401;
            error.code = "INVALID_CREDENTIALS";
            return error;
        };

        if (!user) {
            throw invalidCredentialsError();
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
            throw invalidCredentialsError();
        }

        const token = signAccessToken(user.id);
        return { user: this._toSafeUser(user), token };
    }

    async getUserById(id) {
        const user = await this.userRepository.findById(id);
        if (!user) {
            const error = new Error("User not found.");
            error.status = 401;
            error.code = "USER_NOT_FOUND";
            throw error;
        }
        return this._toSafeUser(user);
    }
}

// Wrapper mirrors the pattern used by settingsService/memoryService: modules
// elsewhere in the codebase `require` this file directly rather than pulling
// from the Kernel, so we expose plain functions backed by the Kernel instance.
const wrapper = {
    signup: (data) => Kernel.get("authService").signup(data),
    login: (data) => Kernel.get("authService").login(data),
    getUserById: (id) => Kernel.get("authService").getUserById(id)
};

module.exports = Object.assign(wrapper, { AuthService });
