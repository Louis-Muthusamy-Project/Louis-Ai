const crypto = require("crypto");

/**
 * ==========================================
 * Encryption - Infrastructure Utility
 * ------------------------------------------
 * Authenticated encryption (AES-256-GCM) for secrets that must be
 * stored at rest - currently only per-user AI provider API keys
 * (see providerCredentialService.js). Never used for anything that
 * needs to be searched/compared server-side (those use hashing, e.g.
 * password reset OTPs) - this is for values we need to recover the
 * original plaintext of, on demand, only on the server.
 *
 * Key handling:
 * - The master key comes from ENCRYPTION_MASTER_KEY (an infrastructure
 *   secret, like JWT_SECRET - NOT a provider API key, so it belongs in
 *   env/.env, not in the per-user Settings database).
 * - If ENCRYPTION_MASTER_KEY is not set, this falls back to deriving a
 *   key from JWT_SECRET (already a required env var) so an existing
 *   deployment doesn't hard-crash - but this is logged clearly, once,
 *   as a warning, since a dedicated key is the correct production
 *   setup (rotating JWT_SECRET would silently break decryption of
 *   every stored API key).
 * - The derived 32-byte key is never stored anywhere; it's re-derived
 *   from the env secret on every process start via scrypt.
 * ==========================================
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM
const SCRYPT_SALT = "yuna-provider-credential-encryption-v1"; // fixed, non-secret domain separator

let _warnedFallback = false;
let _cachedKey = null;

function _resolveMasterSecret() {
    const dedicated = process.env.ENCRYPTION_MASTER_KEY;
    if (dedicated && dedicated.trim()) {
        return dedicated.trim();
    }

    const fallback = process.env.JWT_SECRET;
    if (fallback && fallback.trim()) {
        if (!_warnedFallback) {
            _warnedFallback = true;
            console.warn(
                "[encryption] ENCRYPTION_MASTER_KEY is not set - deriving the " +
                "provider-credential encryption key from JWT_SECRET instead. " +
                "Set a dedicated ENCRYPTION_MASTER_KEY in production so that " +
                "rotating JWT_SECRET does not also break decryption of stored " +
                "API keys."
            );
        }
        return fallback.trim();
    }

    throw new Error(
        "Cannot encrypt/decrypt provider credentials: neither " +
        "ENCRYPTION_MASTER_KEY nor JWT_SECRET is set."
    );
}

function _getKey() {
    if (_cachedKey) return _cachedKey;
    const secret = _resolveMasterSecret();
    _cachedKey = crypto.scryptSync(secret, SCRYPT_SALT, 32);
    return _cachedKey;
}

/**
 * Encrypts a plaintext string. Returns a single self-contained string
 * ("v1:<ivBase64>:<authTagBase64>:<ciphertextBase64>") safe to store in
 * a JSON settings file.
 */
function encrypt(plaintext) {
    if (typeof plaintext !== "string" || plaintext.length === 0) {
        throw new Error("encrypt() requires a non-empty string.");
    }

    const key = _getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
        "v1",
        iv.toString("base64"),
        authTag.toString("base64"),
        ciphertext.toString("base64")
    ].join(":");
}

/**
 * Decrypts a string produced by encrypt(). Throws if the payload is
 * malformed or authentication fails (tampering, wrong key, corruption)
 * rather than returning a garbled/partial value.
 */
function decrypt(payload) {
    if (typeof payload !== "string" || !payload) {
        throw new Error("decrypt() requires a non-empty string.");
    }

    const parts = payload.split(":");
    if (parts.length !== 4 || parts[0] !== "v1") {
        throw new Error("Malformed encrypted payload.");
    }

    const [, ivB64, authTagB64, ciphertextB64] = parts;
    const key = _getKey();
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
}

/** Returns a masked display form ("sk-...ab12") - never the real key. */
function maskSecret(plaintext) {
    if (typeof plaintext !== "string" || plaintext.length === 0) return "";
    if (plaintext.length <= 4) return "*".repeat(plaintext.length);
    return `${"*".repeat(Math.max(plaintext.length - 4, 4))}${plaintext.slice(-4)}`;
}

/** Test-only: clears the cached derived key so tests can swap env secrets. */
function _resetKeyCacheForTests() {
    _cachedKey = null;
    _warnedFallback = false;
}

module.exports = { encrypt, decrypt, maskSecret, _resetKeyCacheForTests };
