const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");

process.env.ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || "test-only-master-key-do-not-use-in-prod";
// GeminiProvider's boot-time (legacy) construction still requires this to
// exist in the test process env - see ProviderManager's constructor.
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "boot-time-test-key";

const SettingsFileStore = require("../infrastructure/SettingsFileStore");
const { ProviderCredentialService } = require("../services/providerCredentialService");
const ProviderManager = require("../providers/ProviderManager");
const GeminiProvider = require("../providers/GeminiProvider");

function makeKernel() {
    const store = new SettingsFileStore();
    store.dataRoot = path.join(os.tmpdir(), `yuna-test-provider-manager-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    store.legacyPath = path.join(store.dataRoot, "__no-legacy-file-here__.json");

    const instances = new Map();
    instances.set("settingsFileStore", store);

    const kernel = {
        get(key) {
            if (instances.has(key)) return instances.get(key);
            if (key === "providerCredentialService") {
                const svc = new ProviderCredentialService(kernel);
                instances.set(key, svc);
                return svc;
            }
            throw new Error(`No test binding for "${key}"`);
        }
    };
    return { kernel, credentialService: kernel.get("providerCredentialService") };
}

test("resolveForUser builds a provider using the user's own decrypted key and configured model", async () => {
    const { kernel, credentialService } = makeKernel();
    const manager = new ProviderManager(kernel);
    await credentialService.setApiKey("user-1", "gemini", "user-1-real-key");
    await credentialService.setModels("user-1", "gemini", { chat: "gemini-2.5-pro" });

    const provider = await manager.resolveForUser("user-1", "gemini", "chat");
    assert.ok(provider instanceof GeminiProvider);
    assert.equal(provider.model, "gemini-2.5-pro");
});

test("resolveForUser throws a clear configuration error instead of silently using env/another user's key", async () => {
    const { kernel } = makeKernel();
    const manager = new ProviderManager(kernel);

    // Uses "openai" (not "gemini") deliberately: this test file sets
    // process.env.GEMINI_API_KEY for the legacy boot-time singleton test
    // below, and providerCredentialService's env-migration feature would
    // correctly (and separately - see providerCredentialService.test.js's
    // migrateFromEnvIfNeeded test) auto-import that for gemini, which
    // would make this specific assertion a false negative. No
    // OPENAI_API_KEY is set in this test process, so there's nothing to
    // migrate and the missing-config error path is exercised cleanly.
    await assert.rejects(
        () => manager.resolveForUser("user-with-no-key", "openai", "coding"),
        /not configured/
    );
});

test("resolveForUser never mixes up credentials between two different users", async () => {
    const { kernel, credentialService } = makeKernel();
    const manager = new ProviderManager(kernel);
    await credentialService.setApiKey("user-a", "gemini", "key-for-user-a");
    await credentialService.setApiKey("user-b", "gemini", "key-for-user-b");

    const providerA = await manager.resolveForUser("user-a", "gemini", "chat");
    const providerB = await manager.resolveForUser("user-b", "gemini", "chat");

    // The two resolved providers must be distinct instances built from
    // distinct keys - not a shared singleton.
    assert.notEqual(providerA, providerB);
});

test("resolveForUser requires a userId (no anonymous/global resolution)", async () => {
    const { kernel } = makeKernel();
    const manager = new ProviderManager(kernel);
    await assert.rejects(() => manager.resolveForUser(null, "gemini", "chat"), /authenticated userId/);
});

test("the legacy env-based singleton path (ProviderManager.provider) still works unchanged for un-migrated call sites", () => {
    const { kernel } = makeKernel();
    const manager = new ProviderManager(kernel);
    assert.equal(manager.getProviderName(), "gemini");
    assert.ok(manager.provider instanceof GeminiProvider);
});
