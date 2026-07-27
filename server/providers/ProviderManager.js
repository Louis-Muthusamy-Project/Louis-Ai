const GeminiProvider = require("./GeminiProvider");

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
}

module.exports = ProviderManager;