const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod";
process.env.JWT_EXPIRES_IN = "1h";
process.env.ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || "test-only-master-key-do-not-use-in-prod";

const Kernel = require("../core/Kernel");
const FileUserRepository = require("../infrastructure/FileUserRepository");
const SettingsFileStore = require("../infrastructure/SettingsFileStore");
const { AuthService } = require("../services/authService");
const { ProviderCredentialService } = require("../services/providerCredentialService");
const { createApp } = require("../config/server");

const testUserRepo = new FileUserRepository();
testUserRepo.filePath = path.join(os.tmpdir(), `yuna-test-users-providers-${Date.now()}.json`);
Kernel.register("userRepository", testUserRepo);
Kernel.register("authService", new AuthService(Kernel));

const testSettingsStore = new SettingsFileStore();
testSettingsStore.dataRoot = path.join(os.tmpdir(), `yuna-test-provider-settings-${Date.now()}`);
testSettingsStore.legacyPath = path.join(testSettingsStore.dataRoot, "__no-legacy__.json");
Kernel.register("settingsFileStore", testSettingsStore);
Kernel.register("settingsService", { getSettings: () => ({}), updateSettings: (v) => v });
Kernel.register("providerCredentialService", new ProviderCredentialService(Kernel));

async function withServer(fn) {
    const { app, server } = createApp();
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    const baseUrl = `http://localhost:${port}`;
    try {
        await fn({ baseUrl });
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

async function signupAndLogin(baseUrl) {
    const email = `provider-settings-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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
    return token;
}

test("provider settings API: requires auth, stores a key, and never returns plaintext", async () => {
    await withServer(async ({ baseUrl }) => {
        const noAuthRes = await fetch(`${baseUrl}/api/settings/providers`);
        assert.equal(noAuthRes.status, 401);

        const token = await signupAndLogin(baseUrl);
        const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

        const listRes = await fetch(`${baseUrl}/api/settings/providers`, { headers: authHeaders });
        assert.equal(listRes.status, 200);
        const listBody = await listRes.json();
        const geminiStatus = listBody.providers.find((p) => p.provider === "gemini");
        assert.equal(geminiStatus.hasKey, false);

        const plaintextKey = "AIzaSy-VERY-SECRET-TEST-KEY-abcd1234";
        const putRes = await fetch(`${baseUrl}/api/settings/providers/gemini/key`, {
            method: "PUT",
            headers: authHeaders,
            body: JSON.stringify({ apiKey: plaintextKey })
        });
        assert.equal(putRes.status, 200);
        const putBody = await putRes.json();
        const rawResponseText = JSON.stringify(putBody);
        assert.equal(rawResponseText.includes(plaintextKey), false, "response body must never contain the plaintext key");
        assert.equal(putBody.provider.hasKey, true);
        assert.equal(putBody.provider.maskedKey.endsWith("1234"), true);

        // Confirm nothing on disk holds the plaintext either.
        const files = fs.readdirSync(testSettingsStore.dataRoot, { recursive: true });
        for (const file of files) {
            const full = path.join(testSettingsStore.dataRoot, file);
            if (fs.statSync(full).isFile()) {
                const contents = fs.readFileSync(full, "utf8");
                assert.equal(contents.includes(plaintextKey), false, `${file} must not contain the plaintext key`);
            }
        }

        const getRes = await fetch(`${baseUrl}/api/settings/providers/gemini`, { headers: authHeaders });
        const getBody = await getRes.json();
        assert.equal(JSON.stringify(getBody).includes(plaintextKey), false);
        assert.equal(getBody.provider.hasKey, true);

        const delRes = await fetch(`${baseUrl}/api/settings/providers/gemini/key`, {
            method: "DELETE",
            headers: authHeaders
        });
        assert.equal(delRes.status, 200);
        const delBody = await delRes.json();
        assert.equal(delBody.provider.hasKey, false);
    });
});

test("provider settings API: rejects an unknown provider name", async () => {
    await withServer(async ({ baseUrl }) => {
        const token = await signupAndLogin(baseUrl);
        const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        const res = await fetch(`${baseUrl}/api/settings/providers/not-a-real-provider`, { headers: authHeaders });
        assert.equal(res.status, 400);
    });
});
