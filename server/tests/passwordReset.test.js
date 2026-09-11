const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod";

const FileUserRepository = require("../infrastructure/FileUserRepository");
const FilePasswordResetRepository = require("../infrastructure/FilePasswordResetRepository");
const { AuthService } = require("../services/authService");
const { PasswordResetService } = require("../services/passwordResetService");

function sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

/** Fake email service - captures what WOULD have been sent, never sends real mail in tests. */
function makeFakeEmailService() {
    const sent = [];
    return {
        sent,
        async sendPasswordResetOtp(toEmail, otp, expiresInMinutes) {
            sent.push({ toEmail, otp, expiresInMinutes });
        }
    };
}

function makeHarness() {
    const userRepo = new FileUserRepository();
    userRepo.filePath = path.join(os.tmpdir(), `yuna-test-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

    const resetRepo = new FilePasswordResetRepository();
    resetRepo.filePath = path.join(os.tmpdir(), `yuna-test-resets-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

    const emailService = makeFakeEmailService();

    const kernel = {
        get(name) {
            if (name === "userRepository") return userRepo;
            if (name === "passwordResetRepository") return resetRepo;
            if (name === "emailService") return emailService;
            throw new Error(`Unexpected kernel.get(${name}) in test harness`);
        }
    };

    const authService = new AuthService(kernel);
    const passwordResetService = new PasswordResetService(kernel);

    return { authService, passwordResetService, userRepo, resetRepo, emailService };
}

async function signupUser(authService, overrides = {}) {
    return authService.signup({
        name: "Reset Test",
        email: "reset@example.com",
        password: "originalPassword123",
        ...overrides
    });
}

// -------------------------------------------------------------------
// Step 1 - request reset
// -------------------------------------------------------------------

test("forgot-password for an unknown email returns the generic message and sends nothing", async () => {
    const { passwordResetService, emailService } = makeHarness();

    const result = await passwordResetService.requestReset("doesnotexist@example.com");

    assert.equal(result.message, "If the account exists, a verification code has been sent.");
    assert.equal(emailService.sent.length, 0);
});

test("forgot-password for a known email returns the SAME generic message but does send an email", async () => {
    const { authService, passwordResetService, emailService } = makeHarness();
    await signupUser(authService);

    const result = await passwordResetService.requestReset("reset@example.com");

    assert.equal(result.message, "If the account exists, a verification code has been sent.");
    assert.equal(emailService.sent.length, 1);
    assert.equal(emailService.sent[0].toEmail, "reset@example.com");
});

test("the generated OTP is always exactly 6 digits", async () => {
    const { authService, passwordResetService, emailService } = makeHarness();
    await signupUser(authService);

    await passwordResetService.requestReset("reset@example.com");

    const otp = emailService.sent[0].otp;
    assert.match(otp, /^\d{6}$/);
});

test("the OTP is never persisted in plaintext - only a hash", async () => {
    const { authService, passwordResetService, resetRepo } = makeHarness();
    const { user } = await signupUser(authService);

    await passwordResetService.requestReset("reset@example.com");

    const record = await resetRepo.findByUserId(user.id);
    assert.ok(record.otpHash);
    assert.equal(record.otpHash.length, 64); // sha256 hex
    assert.ok(!("otp" in record));
});

// -------------------------------------------------------------------
// Step 2 - verify OTP
// -------------------------------------------------------------------

test("verifyOtp succeeds with the correct code and returns a resetToken", async () => {
    const { authService, passwordResetService, emailService } = makeHarness();
    await signupUser(authService);
    await passwordResetService.requestReset("reset@example.com");
    const otp = emailService.sent[0].otp;

    const result = await passwordResetService.verifyOtp("reset@example.com", otp);

    assert.ok(typeof result.resetToken === "string" && result.resetToken.length > 0);
});

test("verifyOtp rejects a wrong code", async () => {
    const { authService, passwordResetService, emailService } = makeHarness();
    await signupUser(authService);
    await passwordResetService.requestReset("reset@example.com");
    const realOtp = emailService.sent[0].otp;
    const wrongOtp = realOtp === "111111" ? "222222" : "111111";

    await assert.rejects(
        () => passwordResetService.verifyOtp("reset@example.com", wrongOtp),
        (err) => err.code === "INVALID_OTP"
    );
});

test("verifyOtp rejects an expired code", async () => {
    const { authService, passwordResetService, emailService, resetRepo, userRepo } = makeHarness();
    const { user } = await signupUser(authService);
    await passwordResetService.requestReset("reset@example.com");
    const otp = emailService.sent[0].otp;

    // Force the stored expiry into the past.
    await resetRepo.upsertOtp(user.id, { otpHash: sha256(otp), otpExpiresAt: new Date(Date.now() - 1000) });

    await assert.rejects(
        () => passwordResetService.verifyOtp("reset@example.com", otp),
        (err) => err.code === "INVALID_OTP"
    );
});

test("verifyOtp enforces an attempt limit after repeated wrong codes", async () => {
    const { authService, passwordResetService, emailService } = makeHarness();
    await signupUser(authService);
    await passwordResetService.requestReset("reset@example.com");
    const realOtp = emailService.sent[0].otp;
    const wrongOtp = realOtp === "111111" ? "222222" : "111111";

    // 5 wrong attempts allowed (OTP_MAX_ATTEMPTS), 6th should be rate-limited.
    for (let i = 0; i < 5; i++) {
        await assert.rejects(() => passwordResetService.verifyOtp("reset@example.com", wrongOtp));
    }

    await assert.rejects(
        () => passwordResetService.verifyOtp("reset@example.com", realOtp),
        (err) => err.code === "OTP_ATTEMPTS_EXCEEDED"
    );
});

test("verifyOtp rejects reuse of an already-verified OTP", async () => {
    const { authService, passwordResetService, emailService } = makeHarness();
    await signupUser(authService);
    await passwordResetService.requestReset("reset@example.com");
    const otp = emailService.sent[0].otp;

    await passwordResetService.verifyOtp("reset@example.com", otp); // first use - succeeds

    await assert.rejects(
        () => passwordResetService.verifyOtp("reset@example.com", otp),
        (err) => err.code === "INVALID_OTP"
    );
});

// -------------------------------------------------------------------
// Step 3 - reset password
// -------------------------------------------------------------------

test("reset-password is rejected with only an email and no resetToken (OTP ownership not proven)", async () => {
    const { authService, passwordResetService } = makeHarness();
    await signupUser(authService);

    await assert.rejects(
        () => passwordResetService.resetPassword({
            email: "reset@example.com",
            resetToken: undefined,
            newPassword: "brandNewPassword123",
            confirmPassword: "brandNewPassword123"
        })
    );
});

test("reset-password rejects mismatched newPassword/confirmPassword", async () => {
    const { authService, passwordResetService, emailService } = makeHarness();
    await signupUser(authService);
    await passwordResetService.requestReset("reset@example.com");
    const otp = emailService.sent[0].otp;
    const { resetToken } = await passwordResetService.verifyOtp("reset@example.com", otp);

    await assert.rejects(
        () => passwordResetService.resetPassword({
            email: "reset@example.com",
            resetToken,
            newPassword: "brandNewPassword123",
            confirmPassword: "somethingElse123"
        }),
        (err) => err.code === "PASSWORD_MISMATCH"
    );
});

test("successful reset: new password is hashed, works for login, and the old password no longer works", async () => {
    const { authService, passwordResetService, emailService, userRepo } = makeHarness();
    await signupUser(authService);
    await passwordResetService.requestReset("reset@example.com");
    const otp = emailService.sent[0].otp;
    const { resetToken } = await passwordResetService.verifyOtp("reset@example.com", otp);

    const result = await passwordResetService.resetPassword({
        email: "reset@example.com",
        resetToken,
        newPassword: "brandNewPassword123",
        confirmPassword: "brandNewPassword123"
    });
    assert.equal(result.success, true);

    // Plaintext new password is never stored.
    const stored = await userRepo.findByEmail("reset@example.com");
    assert.notEqual(stored.passwordHash, "brandNewPassword123");
    assert.ok(stored.passwordHash.startsWith("$2")); // bcrypt hash prefix

    const loginOk = await authService.login({ email: "reset@example.com", password: "brandNewPassword123" });
    assert.ok(loginOk.token);

    await assert.rejects(
        () => authService.login({ email: "reset@example.com", password: "originalPassword123" }),
        (err) => err.code === "INVALID_CREDENTIALS"
    );
});

test("the reset token cannot be reused for a second password change", async () => {
    const { authService, passwordResetService, emailService } = makeHarness();
    await signupUser(authService);
    await passwordResetService.requestReset("reset@example.com");
    const otp = emailService.sent[0].otp;
    const { resetToken } = await passwordResetService.verifyOtp("reset@example.com", otp);

    await passwordResetService.resetPassword({
        email: "reset@example.com",
        resetToken,
        newPassword: "firstNewPassword123",
        confirmPassword: "firstNewPassword123"
    });

    await assert.rejects(
        () => passwordResetService.resetPassword({
            email: "reset@example.com",
            resetToken,
            newPassword: "secondNewPassword123",
            confirmPassword: "secondNewPassword123"
        })
    );
});
