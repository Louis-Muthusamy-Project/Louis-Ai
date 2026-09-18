const GeminiProvider = require("./GeminiProvider");
const OpenAIProvider = require("./OpenAIProvider");
const AnthropicProvider = require("./AnthropicProvider");

/**
 * ==========================================
 * ProviderManager - Per-User AI Provider Resolver
 * ------------------------------------------
 * Per the final API-key architecture requirement, this class holds NO
 * boot-time, env-based, or shared provider state at all. There is no
 * "active provider" singleton and no process.env read anywhere in this
 * file - every provider instance is built fresh, per call, from ONE
 * authenticated user's own decrypted credential (resolveForUser below).
 * ==========================================
 */
class ProviderManager {
    constructor(kernel) {
        this.kernel = kernel;
    }

    /**
     * Resolves a FRESH provider instance built from ONE authenticated
     * user's own encrypted Settings credential, for one capability
     * (chat/prompt/image/embedding/coding/vision).
     *
     * Deliberately NOT cached/reused across calls or users: constructing
     * a provider is cheap (no network call), and caching per-user
     * instances in a shared Map would risk one user's decrypted client
     * lingering in memory or, with a bug, being handed to another
     * user's request. The decrypted API key exists only for the
     * lifetime of this call's provider instance.
     *
     * Throws a clear configuration error (never a silent env fallback)
     * if the user has not configured this provider.
     *
     * @param {string} userId
     * @param {"gemini"|"openai"|"claude"} providerName
     * @param {"chat"|"prompt"|"image"|"embedding"|"coding"|"vision"} capability
     */
    async resolveForUser(userId, providerName, capability) {
        if (!userId) {
            throw new Error("resolveForUser requires an authenticated userId.");
        }

        const providerCredentialService = this.kernel.get("providerCredentialService");
        const { apiKey, model, imageModel } = await providerCredentialService.resolveCredential(
            userId,
            providerName,
            capability
        );

        if (providerName === "gemini") {
            return new GeminiProvider({ apiKey, model, imageModel });
        }
        if (providerName === "openai") {
            return new OpenAIProvider({ apiKey, model });
        }
        if (providerName === "claude") {
            return new AnthropicProvider({ apiKey, model });
        }
        throw new Error(`Unknown AI provider: "${providerName}".`);
    }
}

module.exports = ProviderManager;