const test = require("node:test");
const assert = require("node:assert/strict");

const GeminiProvider = require("../providers/GeminiProvider");
const OpenAIProvider = require("../providers/OpenAIProvider");
const AnthropicProvider = require("../providers/AnthropicProvider");
const ProviderManager = require("../providers/ProviderManager");
const CodingProviderRegistry = require("../services/coding/CodingProviderRegistry");

function makeCredentialService(overrides = {}) {
    return {
        async resolveApiKeyOnly(userId, provider) {
            if (overrides.resolveApiKeyOnly) return overrides.resolveApiKeyOnly(userId, provider);
            return { apiKey: "test-key" };
        },
        async resolveCredential(userId, provider, capability) {
            if (overrides.resolveCredential) return overrides.resolveCredential(userId, provider, capability);
            return { apiKey: "test-key", model: "default-model" };
        },
        getStatus(userId, provider) {
            if (overrides.getStatus) return overrides.getStatus(userId, provider);
            return { hasKey: true, enabled: true, models: { coding: "default-model" } };
        }
    };
}

function makeKernel(credentialServiceOverrides) {
    const credentialService = makeCredentialService(credentialServiceOverrides);
    return { get: (key) => (key === "providerCredentialService" ? credentialService : null) };
}

// ---- GeminiProvider.listModels() (direct REST - no SDK wrapper exists) ----

test("GeminiProvider.listModels: parses the real Gemini REST shape and keeps only generateContent-capable models", async () => {
    const provider = new GeminiProvider({ apiKey: "test-key" });
    const originalFetch = global.fetch;
    let capturedUrl = null;
    global.fetch = async (url) => {
        capturedUrl = url;
        return {
            ok: true,
            json: async () => ({
                models: [
                    { name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash", supportedGenerationMethods: ["generateContent"] },
                    { name: "models/gemini-2.5-pro", displayName: "Gemini 2.5 Pro", supportedGenerationMethods: ["generateContent"] },
                    { name: "models/text-embedding-004", displayName: "Embedding 004", supportedGenerationMethods: ["embedContent"] }
                ]
            })
        };
    };
    try {
        const models = await provider.listModels();
        assert.ok(capturedUrl.includes("generativelanguage.googleapis.com/v1beta/models"));
        assert.ok(capturedUrl.includes("key=test-key"));
        assert.deepEqual(models, [
            { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
            { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" }
        ]);
    } finally {
        global.fetch = originalFetch;
    }
});

test("GeminiProvider.listModels: throws a clear error on a non-OK response instead of returning a fake/empty list silently", async () => {
    const provider = new GeminiProvider({ apiKey: "bad-key" });
    const originalFetch = global.fetch;
    global.fetch = async () => ({ ok: false, status: 401, text: async () => "API key not valid" });
    try {
        await assert.rejects(() => provider.listModels(), /401/);
    } finally {
        global.fetch = originalFetch;
    }
});

// ---- OpenAIProvider.listModels() (SDK models.list(), filtered) ------------

test("OpenAIProvider.listModels: keeps chat/reasoning models and filters out embeddings/tts/whisper/dall-e/moderation", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key" });
    provider.client.models = {
        list: async () => ({
            data: [
                { id: "gpt-5" }, { id: "gpt-5-mini" }, { id: "o3-mini" }, { id: "chatgpt-4o-latest" },
                { id: "text-embedding-3-large" }, { id: "whisper-1" }, { id: "tts-1" }, { id: "dall-e-3" }, { id: "omni-moderation-latest" }
            ]
        })
    };
    const models = await provider.listModels();
    const ids = models.map(m => m.id);
    assert.ok(ids.includes("gpt-5"));
    assert.ok(ids.includes("gpt-5-mini"));
    assert.ok(ids.includes("o3-mini"));
    assert.ok(ids.includes("chatgpt-4o-latest"));
    assert.ok(!ids.includes("text-embedding-3-large"));
    assert.ok(!ids.includes("whisper-1"));
    assert.ok(!ids.includes("tts-1"));
    assert.ok(!ids.includes("dall-e-3"));
    assert.ok(!ids.includes("omni-moderation-latest"));
});

// ---- AnthropicProvider.listModels() (SDK models.list()) -------------------

test("AnthropicProvider.listModels: maps id/display_name from the real SDK response shape", async () => {
    const provider = new AnthropicProvider({ apiKey: "test-key" });
    provider.client.models = {
        list: async () => ({
            data: [
                { id: "claude-sonnet-4-5", display_name: "Claude Sonnet 4.5" },
                { id: "claude-opus-4-5", display_name: "Claude Opus 4.5" }
            ]
        })
    };
    const models = await provider.listModels();
    assert.deepEqual(models, [
        { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
        { id: "claude-opus-4-5", label: "Claude Opus 4.5" }
    ]);
});

// ---- ProviderManager.resolveForListingModels ------------------------------

test("ProviderManager.resolveForListingModels: builds a provider from the key alone, with no capability/model required", async () => {
    const manager = new ProviderManager(makeKernel());
    const provider = await manager.resolveForListingModels("user-1", "openai");
    assert.equal(provider.getName(), "openai");
});

test("ProviderManager.resolveForListingModels: propagates the real 'not configured' error rather than silently returning something usable", async () => {
    const manager = new ProviderManager(makeKernel({
        resolveApiKeyOnly: async () => { throw new Error("openai is not configured. Add an API key for openai in Settings before using it."); }
    }));
    await assert.rejects(() => manager.resolveForListingModels("user-1", "openai"), /not configured/);
});

// ---- CodingProviderRegistry.listModelsForProvider / getCodingProvider(modelOverride) ----

test("CodingProviderRegistry.listModelsForProvider: rejects listing models for a disabled/unconfigured provider", async () => {
    const manager = new ProviderManager(makeKernel({
        getStatus: () => ({ hasKey: false, enabled: false, models: {} })
    }));
    const registry = new CodingProviderRegistry(manager);
    await assert.rejects(() => registry.listModelsForProvider("user-1", "claude"), /not available/);
});

test("CodingProviderRegistry.getCodingProvider: an explicit modelOverride replaces the stored 'coding' capability default", async () => {
    const manager = new ProviderManager(makeKernel({
        resolveCredential: async () => ({ apiKey: "test-key", model: "stored-default-model" })
    }));
    const registry = new CodingProviderRegistry(manager);
    const codingProvider = await registry.getCodingProvider("user-1", "gemini", "gemini-2.5-pro");
    assert.equal(codingProvider.geminiProvider.model, "gemini-2.5-pro");
});

test("CodingProviderRegistry.getCodingProvider: with no override, falls back to the stored 'coding' capability default", async () => {
    const manager = new ProviderManager(makeKernel({
        resolveCredential: async () => ({ apiKey: "test-key", model: "stored-default-model" })
    }));
    const registry = new CodingProviderRegistry(manager);
    const codingProvider = await registry.getCodingProvider("user-1", "gemini");
    assert.equal(codingProvider.geminiProvider.model, "stored-default-model");
});

// ---- getModel() on each real adapter - what the Agent panel actually
// displays as "current model" comes from this, via
// CodingAgentRuntime.run()'s coding:session:start emission. ----

test("GeminiCodingProvider.getModel / OpenAICodingProvider.getModel / ClaudeCodingProvider.getModel: report the real underlying model, not a guess", async () => {
    const GeminiCodingProvider = require("../services/coding/GeminiCodingProvider");
    const OpenAICodingProvider = require("../services/coding/OpenAICodingProvider");
    const ClaudeCodingProvider = require("../services/coding/ClaudeCodingProvider");

    const gemini = new GeminiCodingProvider(new GeminiProvider({ apiKey: "test-key", model: "gemini-2.5-pro" }));
    assert.equal(gemini.getModel(), "gemini-2.5-pro");

    const openai = new OpenAICodingProvider(new OpenAIProvider({ apiKey: "test-key", model: "gpt-5" }));
    assert.equal(openai.getModel(), "gpt-5");

    const claude = new ClaudeCodingProvider(new AnthropicProvider({ apiKey: "test-key", model: "claude-opus-4-5" }));
    assert.equal(claude.getModel(), "claude-opus-4-5");
});
