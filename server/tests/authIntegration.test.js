const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod";
process.env.JWT_EXPIRES_IN = "1h";

const Kernel = require("../core/Kernel");
const FileUserRepository = require("../infrastructure/FileUserRepository");
const { AuthService } = require("../services/authService");
const { createApp } = require("../config/server");
const { createSocketServer } = require("../config/socket");

// Wire just enough of the Kernel for auth.routes / settingsRoutes / socket
// handshake to work, without running the full bootstrap() (which starts
// agents, plugin file watchers, and schedulers we don't want alive during
// a test run).
const testUserRepo = new FileUserRepository();
testUserRepo.filePath = path.join(os.tmpdir(), `yuna-test-users-integration-${Date.now()}.json`);
Kernel.register("userRepository", testUserRepo);
Kernel.register("authService", new AuthService(Kernel));
Kernel.register("settingsService", {
    getSettings: () => ({ theme: "dark" }),
    updateSettings: (v) => v
});

async function withServer(fn) {
    const { app, server } = createApp();
    const io = createSocketServer(server);
    // No socketHandler.js registration needed - these tests only exercise
    // the handshake middleware (io.use), not chat message handling.

    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    const baseUrl = `http://localhost:${port}`;

    try {
        await fn({ baseUrl, io });
    } finally {
        io.close();
        await new Promise((resolve) => server.close(resolve));
    }
}

test("signup -> login -> /me -> settings, end to end over real HTTP", async () => {
    await withServer(async ({ baseUrl }) => {
        const email = `integration-${Date.now()}@example.com`;

        const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Test User", email, password: "correcthorse123" })
        });
        assert.equal(signupRes.status, 201);
        const signupBody = await signupRes.json();
        assert.equal(signupBody.success, true);
        assert.equal(signupBody.user.passwordHash, undefined);

        const meNoTokenRes = await fetch(`${baseUrl}/api/auth/me`);
        assert.equal(meNoTokenRes.status, 401);

        const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: "correcthorse123" })
        });
        assert.equal(loginRes.status, 200);
        const { token } = await loginRes.json();

        const meRes = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(meRes.status, 200);
        const meBody = await meRes.json();
        assert.equal(meBody.user.email, email);

        const settingsNoAuthRes = await fetch(`${baseUrl}/api/settings`);
        assert.equal(settingsNoAuthRes.status, 401);

        const settingsRes = await fetch(`${baseUrl}/api/settings`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(settingsRes.status, 200);
    });
});

test("wrong password returns a generic 401, never revealing which field was wrong", async () => {
    await withServer(async ({ baseUrl }) => {
        const email = `wrongpw-${Date.now()}@example.com`;
        await fetch(`${baseUrl}/api/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Test User", email, password: "correcthorse123" })
        });

        const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: "totallywrong" })
        });
        assert.equal(res.status, 401);
        const body = await res.json();
        assert.equal(body.code, "INVALID_CREDENTIALS");
        assert.equal(body.message, "Invalid email or password.");
    });
});

test("Socket.IO rejects connections without a valid token and accepts a valid one", async () => {
    const { io: ioClient } = require("socket.io-client");

    await withServer(async ({ baseUrl }) => {
        const email = `socket-${Date.now()}@example.com`;
        await fetch(`${baseUrl}/api/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Test User", email, password: "correcthorse123" })
        });
        const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: "correcthorse123" })
        });
        const { token } = await loginRes.json();

        const attempt = (authToken) => new Promise((resolve) => {
            const socket = ioClient(baseUrl, { auth: { token: authToken }, reconnection: false, timeout: 2000 });
            const finish = (outcome) => { socket.close(); resolve(outcome); };
            socket.on("connect", () => finish({ connected: true }));
            socket.on("connect_error", (err) => finish({ connected: false, code: err.data && err.data.code }));
            setTimeout(() => finish({ connected: false, code: "TIMEOUT" }), 3000);
        });

        const noToken = await attempt(undefined);
        assert.equal(noToken.connected, false);
        assert.equal(noToken.code, "NO_TOKEN");

        const badToken = await attempt("not-a-real-token");
        assert.equal(badToken.connected, false);
        assert.equal(badToken.code, "INVALID_TOKEN");

        const goodToken = await attempt(token);
        assert.equal(goodToken.connected, true);
    });
});
