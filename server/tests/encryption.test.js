const test = require("node:test");
const assert = require("node:assert/strict");

process.env.ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || "test-only-master-key-do-not-use-in-prod";

const { encrypt, decrypt, maskSecret, _resetKeyCacheForTests } = require("../utils/encryption");

test("encrypt/decrypt round-trips a plaintext API key", () => {
    const plaintext = "sk-real-secret-api-key-1234567890";
    const encrypted = encrypt(plaintext);

    assert.notEqual(encrypted, plaintext);
    assert.equal(decrypt(encrypted), plaintext);
});

test("encrypted payload never contains the plaintext substring", () => {
    const plaintext = "AIzaSyVERY-SENSITIVE-GEMINI-KEY-VALUE";
    const encrypted = encrypt(plaintext);
    assert.equal(encrypted.includes(plaintext), false);
    assert.equal(encrypted.includes("VERY-SENSITIVE"), false);
});

test("two encryptions of the same plaintext produce different ciphertext (random IV)", () => {
    const plaintext = "same-key-twice";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    assert.notEqual(a, b);
    assert.equal(decrypt(a), plaintext);
    assert.equal(decrypt(b), plaintext);
});

test("tampering with the ciphertext is detected (GCM auth tag fails)", () => {
    const encrypted = encrypt("tamper-test-key");
    const parts = encrypted.split(":");
    // Flip the last character of the ciphertext portion.
    const ciphertext = parts[3];
    const flipped = ciphertext.slice(0, -1) + (ciphertext.at(-1) === "A" ? "B" : "A");
    const tampered = [parts[0], parts[1], parts[2], flipped].join(":");

    assert.throws(() => decrypt(tampered));
});

test("tampering with the auth tag is detected", () => {
    const encrypted = encrypt("tamper-test-key-2");
    const parts = encrypted.split(":");
    const authTag = parts[2];
    const flipped = authTag.slice(0, -1) + (authTag.at(-1) === "A" ? "B" : "A");
    const tampered = [parts[0], flipped, parts[2], parts[3]].join(":");

    assert.throws(() => decrypt(tampered));
});

test("decrypt rejects malformed payloads instead of returning garbage", () => {
    assert.throws(() => decrypt("not-a-valid-payload"));
    assert.throws(() => decrypt(""));
    assert.throws(() => decrypt("v2:a:b:c"));
});

test("encrypt rejects empty input", () => {
    assert.throws(() => encrypt(""));
    assert.throws(() => encrypt(null));
});

test("maskSecret never reveals the full key", () => {
    const masked = maskSecret("sk-abcdefghijklmnop1234");
    assert.equal(masked.endsWith("1234"), true);
    assert.equal(masked.includes("abcdefgh"), false);
});

test("falls back to deriving the key from JWT_SECRET when ENCRYPTION_MASTER_KEY is unset, and stays decryptable", () => {
    const savedMaster = process.env.ENCRYPTION_MASTER_KEY;
    const savedJwt = process.env.JWT_SECRET;
    try {
        delete process.env.ENCRYPTION_MASTER_KEY;
        process.env.JWT_SECRET = "fallback-jwt-secret-for-test";
        _resetKeyCacheForTests();

        const encrypted = encrypt("fallback-path-key");
        assert.equal(decrypt(encrypted), "fallback-path-key");
    } finally {
        process.env.ENCRYPTION_MASTER_KEY = savedMaster;
        process.env.JWT_SECRET = savedJwt;
        _resetKeyCacheForTests();
    }
});
