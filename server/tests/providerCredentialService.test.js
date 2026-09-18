const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

process.env.ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || "test-only-master-key-do-not-use-in-prod";

const SettingsFileStore = require("../infrastructure/SettingsFileStore");
const { ProviderCredentialService } = require("../services/providerCredentialService");

function makeService() {
    const store = new SettingsFileStore();
    // Isolate this test run's files from real user data / other test runs.
    store.dataRoot = path.join(os.tmpdir(), `yuna-test-provider-credentials-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    store.legacyPath = path.join(store.dataRoot, "__no-legacy-file-here__.json");

    const fakeKernel = { get: (key) => (key === "settingsFileStore" ? store : null) };
    return { service: new ProviderCredentialService(fakeKernel), store };
}

test("setApiKey stores an encrypted key and listStatus never exposes plaintext or ciphertext", async () => {
    const { service, store } = makeService();
    const userId = "user-1";

    await service.setApiKey(userId, "gemini", "AIzaSyREAL-PLAINTEXT-KEY");

    const rawFile = fs.readFileSync(path.join(store.dataRoot, userId, "settings.json"), "utf8");
    assert.equal(rawFile.includes("AIzaSyREAL-PLAINTEXT-KEY"), false, "plaintext key must never be written to disk");

    const status = service.getStatus(userId, "gemini");
    assert.equal(status.hasKey, true);
    assert.equal(status.enabled, true);
    assert.equal(JSON.stringify(status).includes("AIzaSyREAL-PLAINTEXT-KEY"), false);
    assert.equal(status.maskedKey.endsWith("-KEY"), true);
    assert.notEqual(status.maskedKey, "AIzaSyREAL-PLAINTEXT-KEY");
});

test("listStatus returns all three supported providers even with nothing configured", () => {
    const { service } = makeService();
    const list = service.listStatus("user-2");
    const names = list.map((p) => p.provider).sort();
    assert.deepEqual(names, ["claude", "gemini", "openai"]);
    for (const status of list) {
        assert.equal(status.hasKey, false);
        assert.equal(status.enabled, false);
    }
});

test("resolveCredential decrypts the key and returns the capability's configured model", async () => {
    const { service } = makeService();
    const userId = "user-3";
    await service.setApiKey(userId, "gemini", "plain-gemini-key");
    await service.setModels(userId, "gemini", { chat: "gemini-2.5-pro" });

    const resolved = await service.resolveCredential(userId, "gemini", "chat");
    assert.equal(resolved.apiKey, "plain-gemini-key");
    assert.equal(resolved.model, "gemini-2.5-pro");
});

test("resolveCredential throws a clear config error when no key is set (no silent fallback)", async () => {
    const { service } = makeService();
    await assert.rejects(
        () => service.resolveCredential("user-4", "openai", "coding"),
        /openai is not configured/
    );
});

test("removeApiKey clears the key and resolveCredential then fails again", async () => {
    const { service } = makeService();
    const userId = "user-5";
    await service.setApiKey(userId, "claude", "plain-claude-key");
    assert.equal((await service.resolveCredential(userId, "claude", "coding")).apiKey, "plain-claude-key");

    await service.removeApiKey(userId, "claude");
    const status = service.getStatus(userId, "claude");
    assert.equal(status.hasKey, false);
    await assert.rejects(() => service.resolveCredential(userId, "claude", "coding"));
});

test("setEnabled(false) disables a configured provider without deleting the key, and re-enabling restores it", async () => {
    const { service } = makeService();
    const userId = "user-6";
    await service.setApiKey(userId, "gemini", "plain-gemini-key-2");

    await service.setEnabled(userId, "gemini", false);
    assert.equal(service.getStatus(userId, "gemini").enabled, false);
    await assert.rejects(() => service.resolveCredential(userId, "gemini", "chat"));

    await service.setEnabled(userId, "gemini", true);
    assert.equal(service.getStatus(userId, "gemini").enabled, true);
    assert.equal((await service.resolveCredential(userId, "gemini", "chat")).apiKey, "plain-gemini-key-2");
});

test("setEnabled throws for a provider with no key configured", async () => {
    const { service } = makeService();
    await assert.rejects(() => service.setEnabled("user-7", "openai", true), /no API key is configured/);
});

test("credentials are isolated per user - one user's key is invisible to another", async () => {
    const { service } = makeService();
    await service.setApiKey("user-a", "gemini", "user-a-key");

    const statusForB = service.getStatus("user-b", "gemini");
    assert.equal(statusForB.hasKey, false);
    await assert.rejects(() => service.resolveCredential("user-b", "gemini", "chat"));

    // user-a's own credential is unaffected
    assert.equal((await service.resolveCredential("user-a", "gemini", "chat")).apiKey, "user-a-key");
});

test("migrateFromEnvIfNeeded imports an existing env key exactly once, and removal is never re-imported", async () => {
    const { service } = makeService();
    const userId = "user-8";
    const savedEnv = process.env.GEMINI_API_KEY;
    try {
        process.env.GEMINI_API_KEY = "env-provided-gemini-key";

        await service.migrateFromEnvIfNeeded(userId, "gemini");
        assert.equal((await service.resolveCredential(userId, "gemini", "chat")).apiKey, "env-provided-gemini-key");

        // Simulate the user explicitly removing it - env must not re-import.
        await service.removeApiKey(userId, "gemini");
        await service.migrateFromEnvIfNeeded(userId, "gemini");
        assert.equal(service.getStatus(userId, "gemini").hasKey, false);
    } finally {
        if (savedEnv === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = savedEnv;
    }
});

test("setModels only accepts models for capabilities the provider actually supports", async () => {
    const { service } = makeService();
    const userId = "user-9";
    await service.setApiKey(userId, "openai", "openai-key");

    await service.setModels(userId, "openai", { coding: "gpt-6", image: "should-be-ignored" });
    const status = service.getStatus(userId, "openai");
    assert.equal(status.models.coding, "gpt-6");
    assert.equal("image" in status.models, false);
});
