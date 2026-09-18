const Kernel = require("../core/Kernel");
const { encrypt, decrypt, maskSecret } = require("../utils/encryption");

/**
 * ==========================================
 * ProviderCredentialService - Service Layer Class
 * ------------------------------------------
 * Stores ONE encrypted API-key record per (user, provider) - gemini,
 * openai, claude - regardless of how many capabilities (chat, prompt,
 * image, embedding, coding) that provider is used for. Lives inside
 * the same per-user settings.json the rest of Settings already uses
 * (via SettingsFileStore), under a "providerCredentials" key, so no
 * new storage layer/migration is needed.
 *
 * Settings shape (per user):
 * {
 *   providerCredentials: {
 *     gemini: {
 *       apiKeyEncrypted: "v1:...",
 *       maskedKey: "************ab12",
 *       models: { chat: "gemini-2.5-flash", prompt: "...", image: "...", embedding: "...", coding: "..." },
 *       enabled: true,
 *       updatedAt: "2026-09-16T..."
 *     },
 *     openai: { ... },
 *     claude: { ... }
 *   }
 * }
 *
 * The encrypted key NEVER leaves this service in a decryptable form
 * except via decryptApiKey(), which is only called by provider
 * resolution (ProviderManager.resolveForUser) on the server - never
 * from a route handler, never sent over Socket.IO, never logged.
 * ==========================================
 */

const SUPPORTED_PROVIDERS = ["gemini", "openai", "claude"];

// Capabilities each provider is applicable for, and the config module
// that supplies its "no per-user override yet" default model - mirrors
// the env-based defaults ProviderManager used before per-user settings
// existed, so a user who hasn't touched Settings yet still gets a
// sensible default model once they add a key.
const PROVIDER_CAPABILITIES = {
    gemini: ["chat", "prompt", "image", "embedding", "coding"],
    openai: ["prompt", "coding"],
    claude: ["prompt", "coding"]
};

function _defaultModelsFor(provider) {
    if (provider === "gemini") {
        const geminiConfig = require("../config/gemini");
        return {
            chat: geminiConfig.model,
            prompt: geminiConfig.model,
            image: geminiConfig.imageModel,
            embedding: geminiConfig.model,
            coding: geminiConfig.model
        };
    }
    if (provider === "openai") {
        const openaiConfig = require("../config/openai");
        return { prompt: openaiConfig.model, coding: openaiConfig.model };
    }
    if (provider === "claude") {
        const anthropicConfig = require("../config/anthropic");
        return { prompt: anthropicConfig.model, coding: anthropicConfig.model };
    }
    return {};
}

// Maps a provider name to the env var it used to be configured from,
// used ONLY for the one-time best-effort migration below - never read
// again after a user has a stored (or explicitly absent) credential.
const ENV_KEY_BY_PROVIDER = {
    gemini: "GEMINI_API_KEY",
    openai: "OPENAI_API_KEY",
    claude: "ANTHROPIC_API_KEY"
};

class ProviderCredentialService {
    constructor(kernel) {
        this.kernel = kernel;
    }

    get store() {
        return this.kernel.get("settingsFileStore");
    }

    _requireProvider(provider) {
        if (!SUPPORTED_PROVIDERS.includes(provider)) {
            throw new Error(`Unsupported AI provider: "${provider}".`);
        }
    }

    _requireUserId(userId) {
        if (!userId) {
            throw new Error("ProviderCredentialService requires an authenticated userId.");
        }
    }

    _readAll(userId) {
        const settings = this.store.read(userId) || {};
        return settings.providerCredentials || {};
    }

    /**
     * SettingsFileStore.write() is asynchronous (it serializes concurrent
     * writes per user through a promise chain, even though the actual
     * fs call inside it is writeFileSync) - so every mutating method here
     * MUST await this, or a caller that reads back its own write (routes,
     * tests, resolveCredential right after setApiKey) can race and see
     * stale data. This is not just a test nicety: an HTTP handler that
     * responded before the write actually landed would be a real bug.
     */
    async _writeAll(userId, providerCredentials) {
        const settings = this.store.read(userId) || {};
        settings.providerCredentials = providerCredentials;
        await this.store.write(userId, settings);
    }

    /**
     * One-time, best-effort import of an existing environment-configured
     * API key into this user's encrypted Settings record, mirroring the
     * exact pattern SettingsFileStore already uses for legacy global
     * settings.json. Only runs when the user has NO stored record yet
     * for this provider (including no explicit "removed" state) - once a
     * user has any record (even a deliberately empty/disabled one), the
     * environment variable is never consulted again for them.
     */
    async migrateFromEnvIfNeeded(userId, provider) {
        this._requireUserId(userId);
        this._requireProvider(provider);

        const all = this._readAll(userId);
        if (all[provider]) return; // already has (or explicitly lacks) a record

        const envKey = process.env[ENV_KEY_BY_PROVIDER[provider]];
        if (!envKey || !envKey.trim()) return;

        try {
            await this.setApiKey(userId, provider, envKey.trim());
            console.log(
                `[ProviderCredentialService] Migrated existing ${ENV_KEY_BY_PROVIDER[provider]} ` +
                `into encrypted per-user Settings for the first authenticated user (${provider}).`
            );
        } catch (error) {
            console.error(`[ProviderCredentialService] Env migration failed for ${provider}:`, error.message);
        }
    }

    /**
     * Returns non-secret status for every supported provider - safe to
     * send to the frontend Settings UI as-is.
     */
    listStatus(userId) {
        this._requireUserId(userId);
        const all = this._readAll(userId);
        return SUPPORTED_PROVIDERS.map((provider) => this._toStatus(provider, all[provider]));
    }

    getStatus(userId, provider) {
        this._requireUserId(userId);
        this._requireProvider(provider);
        const all = this._readAll(userId);
        return this._toStatus(provider, all[provider]);
    }

    _toStatus(provider, record) {
        return {
            provider,
            hasKey: !!(record && record.apiKeyEncrypted),
            maskedKey: (record && record.maskedKey) || null,
            enabled: !!(record && record.enabled),
            models: (record && record.models) || _defaultModelsFor(provider),
            capabilities: PROVIDER_CAPABILITIES[provider] || [],
            updatedAt: (record && record.updatedAt) || null
        };
    }

    async setApiKey(userId, provider, plaintextApiKey) {
        this._requireUserId(userId);
        this._requireProvider(provider);
        if (!plaintextApiKey || !plaintextApiKey.trim()) {
            throw new Error("A non-empty API key is required.");
        }

        const all = this._readAll(userId);
        const existing = all[provider] || {};

        all[provider] = {
            apiKeyEncrypted: encrypt(plaintextApiKey.trim()),
            maskedKey: maskSecret(plaintextApiKey.trim()),
            models: { ..._defaultModelsFor(provider), ...(existing.models || {}) },
            enabled: true,
            updatedAt: new Date().toISOString()
        };

        await this._writeAll(userId, all);
        return this._toStatus(provider, all[provider]);
    }

    async setModels(userId, provider, models = {}) {
        this._requireUserId(userId);
        this._requireProvider(provider);

        const allowedCapabilities = PROVIDER_CAPABILITIES[provider] || [];
        const sanitizedModels = {};
        for (const capability of allowedCapabilities) {
            if (typeof models[capability] === "string" && models[capability].trim()) {
                sanitizedModels[capability] = models[capability].trim();
            }
        }

        const all = this._readAll(userId);
        const existing = all[provider] || {
            apiKeyEncrypted: null,
            maskedKey: null,
            models: _defaultModelsFor(provider),
            enabled: false
        };

        existing.models = { ...existing.models, ...sanitizedModels };
        existing.updatedAt = new Date().toISOString();
        all[provider] = existing;

        await this._writeAll(userId, all);
        return this._toStatus(provider, all[provider]);
    }

    async setEnabled(userId, provider, enabled) {
        this._requireUserId(userId);
        this._requireProvider(provider);

        const all = this._readAll(userId);
        if (!all[provider] || !all[provider].apiKeyEncrypted) {
            throw new Error(`Cannot enable "${provider}": no API key is configured.`);
        }
        all[provider].enabled = !!enabled;
        all[provider].updatedAt = new Date().toISOString();
        await this._writeAll(userId, all);
        return this._toStatus(provider, all[provider]);
    }

    async removeApiKey(userId, provider) {
        this._requireUserId(userId);
        this._requireProvider(provider);

        const all = this._readAll(userId);
        // Explicitly recorded as "no key" (not just absent) so
        // migrateFromEnvIfNeeded never re-imports a removed key.
        all[provider] = {
            apiKeyEncrypted: null,
            maskedKey: null,
            models: (all[provider] && all[provider].models) || _defaultModelsFor(provider),
            enabled: false,
            updatedAt: new Date().toISOString()
        };
        await this._writeAll(userId, all);
        return this._toStatus(provider, all[provider]);
    }

    /**
     * Decrypts and returns { apiKey, model } for one capability of one
     * provider. Server-internal only (see file header) - never expose
     * this method's return value through a route or socket event.
     * Throws a clear, non-leaking configuration error if unavailable,
     * rather than silently falling back to anything.
     */
    async resolveCredential(userId, provider, capability) {
        this._requireUserId(userId);
        this._requireProvider(provider);

        await this.migrateFromEnvIfNeeded(userId, provider);

        const all = this._readAll(userId);
        const record = all[provider];

        if (!record || !record.apiKeyEncrypted || !record.enabled) {
            throw new Error(
                `${provider} is not configured. Add an API key for ${provider} in Settings before using it.`
            );
        }

        const models = record.models || _defaultModelsFor(provider);
        const model = models[capability] || _defaultModelsFor(provider)[capability];
        if (!model) {
            throw new Error(`${provider} has no model configured for "${capability}".`);
        }

        return {
            apiKey: decrypt(record.apiKeyEncrypted),
            model,
            imageModel: models.image
        };
    }
}

const wrapper = {
    SUPPORTED_PROVIDERS,
    PROVIDER_CAPABILITIES,
    listStatus: (userId) => Kernel.get("providerCredentialService").listStatus(userId),
    getStatus: (userId, provider) => Kernel.get("providerCredentialService").getStatus(userId, provider),
    setApiKey: (userId, provider, key) => Kernel.get("providerCredentialService").setApiKey(userId, provider, key),
    setModels: (userId, provider, models) => Kernel.get("providerCredentialService").setModels(userId, provider, models),
    setEnabled: (userId, provider, enabled) => Kernel.get("providerCredentialService").setEnabled(userId, provider, enabled),
    removeApiKey: (userId, provider) => Kernel.get("providerCredentialService").removeApiKey(userId, provider),
    resolveCredential: (userId, provider, capability) => Kernel.get("providerCredentialService").resolveCredential(userId, provider, capability)
};

module.exports = Object.assign(wrapper, { ProviderCredentialService });
