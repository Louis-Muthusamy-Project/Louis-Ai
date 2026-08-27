const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod";

const FileUserRepository = require("../infrastructure/FileUserRepository");
const { AuthService } = require("../services/authService");

/** Builds an AuthService wired to a throwaway users.json under the OS tmp dir. */
function makeIsolatedAuthService() {
    const repo = new FileUserRepository();
    repo.filePath = path.join(os.tmpdir(), `yuna-test-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

    const fakeKernel = { get: (name) => (name === "userRepository" ? repo : undefined) };
    const authService = new AuthService(fakeKernel);
    return { authService, repo };
}

test("signup creates a user, hashes the password, and returns a token", async () => {
    const { authService } = makeIsolatedAuthService();

    const { user, token } = await authService.signup({
        name: "Louis",
        email: "Louis@Example.com",
        password: "correcthorse123"
    });

    assert.equal(user.email, "louis@example.com"); // normalized
    assert.equal(user.passwordHash, undefined); // never returned
    assert.ok(typeof token === "string" && token.length > 0);
});

test("signup rejects a short password", async () => {
    const { authService } = makeIsolatedAuthService();
    await assert.rejects(
        () => authService.signup({ name: "Louis", email: "a@b.com", password: "short" }),
        (err) => err.code === "VALIDATION_ERROR"
    );
});

test("signup rejects a duplicate email", async () => {
    const { authService } = makeIsolatedAuthService();
    await authService.signup({ name: "Louis", email: "dup@example.com", password: "correcthorse123" });

    await assert.rejects(
        () => authService.signup({ name: "Someone Else", email: "dup@example.com", password: "correcthorse123" }),
        (err) => err.code === "EMAIL_TAKEN" && err.status === 409
    );
});

test("login succeeds with correct credentials and fails with wrong password", async () => {
    const { authService } = makeIsolatedAuthService();
    await authService.signup({ name: "Louis", email: "login@example.com", password: "correcthorse123" });

    const ok = await authService.login({ email: "login@example.com", password: "correcthorse123" });
    assert.ok(ok.token);

    await assert.rejects(
        () => authService.login({ email: "login@example.com", password: "wrongpassword" }),
        (err) => err.code === "INVALID_CREDENTIALS" && err.status === 401
    );
});

test("login gives the same generic error for a nonexistent email as for a wrong password", async () => {
    const { authService } = makeIsolatedAuthService();
    await authService.signup({ name: "Louis", email: "exists@example.com", password: "correcthorse123" });

    let unknownEmailError;
    try {
        await authService.login({ email: "doesnotexist@example.com", password: "whatever123" });
    } catch (e) {
        unknownEmailError = e;
    }

    let wrongPasswordError;
    try {
        await authService.login({ email: "exists@example.com", password: "wrongpassword" });
    } catch (e) {
        wrongPasswordError = e;
    }

    assert.equal(unknownEmailError.message, wrongPasswordError.message);
    assert.equal(unknownEmailError.code, wrongPasswordError.code);
});
