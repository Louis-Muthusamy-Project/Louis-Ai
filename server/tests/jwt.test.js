const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod";
process.env.JWT_EXPIRES_IN = "1h";

const { signAccessToken, verifyAccessToken } = require("../utils/jwt");

test("signAccessToken/verifyAccessToken round-trip carries only the user id", () => {
    const token = signAccessToken("user-123");
    const decoded = verifyAccessToken(token);
    assert.equal(decoded.sub, "user-123");
});

test("verifyAccessToken rejects a tampered token", () => {
    const token = signAccessToken("user-123");
    const tampered = token.slice(0, -2) + "xx";
    assert.throws(() => verifyAccessToken(tampered));
});

test("verifyAccessToken rejects an expired token", () => {
    const jwt = require("jsonwebtoken");
    const expired = jwt.sign({ sub: "user-123" }, process.env.JWT_SECRET, { expiresIn: -10 });
    assert.throws(() => verifyAccessToken(expired), /jwt expired/);
});

test("signAccessToken refuses to sign without a user id", () => {
    assert.throws(() => signAccessToken(undefined));
});
