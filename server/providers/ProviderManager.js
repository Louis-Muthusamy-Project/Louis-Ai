const GeminiProvider = require("./GeminiProvider");
const OpenAIProvider = require("./OpenAIProvider");
const AnthropicProvider = require("./AnthropicProvider");

/**
 * ==========================================
 * ProviderManager - Decoupled AI Orchestrator Strategy Manager
 * ==========================================
 */
class ProviderManager {
    constructor(kernel) {
        this.kernel = kernel;
        this.providers = new Map();
        
        // Register default Gemini provider
        this.register("gemini", new GeminiProvider(kernel));

        // OpenAI and Claude are ONLY used by the Coding panel and are
        // genuinely optional - unlike Gemini, the app must start fine
        // without either key configured. Each provider's own constructor
        // throws if its key is missing, so registration is guarded here
        // rather than letting that exception propagate out of
        // ProviderManager's constructor and break the whole app.
        try {
            if (process.env.OPENAI_API_KEY) {
                this.register("openai", new OpenAIProvider());
            }
        } catch (error) {
            console.warn(`[ProviderManager] OpenAI provider not registered: ${error.message}`);
        }
        try {
            if (process.env.ANTHROPIC_API_KEY) {
                this.register("claude", new AnthropicProvider());
            }
        } catch (error) {
            console.warn(`[ProviderManager] Claude provider not registered: ${error.message}`);
        }
        
        this.activeProvider = process.env.AI_PROVIDER || "gemini";
        
        if (!this.providers.has(this.activeProvider)) {
            console.warn(
                `[ProviderManager] Unknown provider "${this.activeProvider}". Falling back to Gemini.`
            );
            this.activeProvider = "gemini";
        }
    }

    get provider() {
        return this.providers.get(this.activeProvider);
    }

    getProviderName() {
        return this.provider ? this.provider.getName() : "none";
    }

    setProvider(name) {
        if (!this.providers.has(name)) {
            throw new Error(`Unknown AI provider: ${name}`);
        }
        this.activeProvider = name;
    }

    register(name, provider) {
        if (!name || !provider) {
            throw new Error("Invalid provider registration.");
        }
        this.providers.set(name, provider);
    }

    /**
     * Returns the raw provider instance for a specific name, regardless of
     * which one is the globally "active" provider for normal chat. Used by
     * the coding agent, where the user picks a model per coding task
     * independent of the Chat tab's active provider.
     */
    getRawProvider(name) {
        return this.providers.get(name) || null;
    }

    async generate(contents) {
        if (!this.provider) {
            throw new Error("No active AI provider configured.");
        }
        return this.provider.generate(contents);
    }

    async stream(contents, callbacks = {}) {
        if (!this.provider) {
            throw new Error("No active AI provider configured.");
        }

        if (typeof this.provider.stream === "function") {
            return this.provider.stream(contents, callbacks);
        }

        // Fallback execution
        const text = await this.provider.generate(contents);

        if (callbacks.onStart) {
            await callbacks.onStart();
        }

        if (callbacks.onChunk) {
            await callbacks.onChunk({
                chunk: text,
                fullText: text,
                done: false
            });
        }

        if (callbacks.onComplete) {
            await callbacks.onComplete({
                text,
                done: true
            });
        }

        return text;
    }

    async embed(text) {
        if (!this.provider) {
            throw new Error("No active AI provider configured.");
        }
        if (typeof this.provider.embed === "function") {
            return this.provider.embed(text);
        }
        throw new Error("Active AI provider does not support embeddings.");
    }

    async generateImage(prompt) {
        if (!this.provider) {
            throw new Error("No active AI provider configured.");
        }
        if (typeof this.provider.generateImage === "function") {
            return this.provider.generateImage(prompt);
        }
        throw new Error("Active AI provider does not support image generation.");
    }

    /**
     * Resolves a FRESH provider instance built from ONE authenticated
     * user's own encrypted Settings credential, for one capability
     * (chat/prompt/image/embedding/coding). This is the per-user-aware
     * counterpart to the legacy `.provider` singleton above (which is
     * still constructed once at boot from process.env, for call sites
     * not yet migrated to this - see ProviderManager's constructor
     * comments and the yuna-project migration notes).
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
     * @param {"chat"|"prompt"|"image"|"embedding"|"coding"} capability
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