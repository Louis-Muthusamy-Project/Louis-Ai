const GeminiCodingProvider = require("./GeminiCodingProvider");
const OpenAICodingProvider = require("./OpenAICodingProvider");
const ClaudeCodingProvider = require("./ClaudeCodingProvider");

/**
 * ==========================================
 * CodingProviderRegistry
 * ------------------------------------------
 * The Coding panel's model selector must show Gemini/ChatGPT/Claude, with
 * each one's real availability - never hidden, never faked as available
 * when it isn't. This is the single source of truth for that status, and
 * for actually constructing the right CodingModelProvider adapter for a
 * task.
 *
 * Per-user, per the API-key architecture: availability and provider
 * construction are both scoped to ONE authenticated user's own encrypted
 * Settings credential (see providerCredentialService.js /
 * ProviderManager.resolveForUser) - never the boot-time env-based
 * singleton, never shared across users. User A's coding-provider status
 * and User B's are computed independently from their own stored records.
 * ==========================================
 */
class CodingProviderRegistry {
    constructor(providerManager) {
        this.providerManager = providerManager;
    }

    get providerCredentialService() {
        return this.providerManager.kernel.get("providerCredentialService");
    }

    /**
     * @param {string} userId authenticated user id - never client-supplied
     * @returns {Array<{name: string, label: string, enabled: boolean, reason?: string, model?: string}>}
     */
    getProviderStatus(userId) {
        if (!userId) {
            throw new Error("CodingProviderRegistry.getProviderStatus requires an authenticated userId.");
        }
        return [
            this._statusFor(userId, "gemini", "Gemini"),
            this._statusFor(userId, "openai", "ChatGPT"),
            this._statusFor(userId, "claude", "Claude")
        ];
    }

    _statusFor(userId, name, label) {
        // getStatus is a cheap, synchronous, non-secret read (masked key
        // only, never decrypted) - safe to call just to show UI status.
        const status = this.providerCredentialService.getStatus(userId, name);
        const enabled = !!(status.hasKey && status.enabled);
        return {
            name,
            label,
            enabled,
            reason: enabled ? undefined : (status.hasKey ? "Provider is disabled" : "API key not configured"),
            model: enabled ? (status.models && status.models.coding) : undefined
        };
    }

    /**
     * @param {string} userId authenticated user id - never client-supplied
     * @param {"gemini"|"openai"|"claude"} name
     * @returns {Promise<import('./CodingModelProvider')>}
     */
    async getCodingProvider(userId, name) {
        if (!userId) {
            throw new Error("CodingProviderRegistry.getCodingProvider requires an authenticated userId.");
        }
        const status = this.getProviderStatus(userId).find((p) => p.name === name);
        if (!status) {
            throw new Error(`Unknown coding provider: ${name}`);
        }
        if (!status.enabled) {
            throw new Error(`Coding provider "${status.label}" is not available: ${status.reason}`);
        }

        // Resolves THIS user's own decrypted credential and builds a fresh,
        // never-cached provider instance - see ProviderManager.resolveForUser.
        const rawProvider = await this.providerManager.resolveForUser(userId, name, "coding");

        switch (name) {
            case "gemini":
                return new GeminiCodingProvider(rawProvider);
            case "openai":
                return new OpenAICodingProvider(rawProvider);
            case "claude":
                return new ClaudeCodingProvider(rawProvider);
            default:
                // Unreachable given the status check above, but keeps this
                // switch honest if a new name is ever added to getProviderStatus
                // without a matching case here.
                throw new Error(`No coding provider adapter implemented for "${name}" yet.`);
        }
    }
}

module.exports = CodingProviderRegistry;
