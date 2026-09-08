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
 * All three adapters are now genuinely implemented (Gemini via
 * @google/genai native function calling, OpenAI via the Responses API,
 * Claude via the Messages API's native tool use). Availability is
 * therefore purely a function of whether ProviderManager actually
 * registered that provider - which itself only happens when the
 * corresponding API key env var was present at startup (see
 * ProviderManager's constructor). Enabled here is never based on "the SDK
 * package is installed" - only on an actually-constructed, keyed provider
 * instance existing.
 * ==========================================
 */
class CodingProviderRegistry {
    constructor(providerManager) {
        this.providerManager = providerManager;
    }

    /**
     * @returns {Array<{name: string, label: string, enabled: boolean, reason?: string, model?: string}>}
     */
    getProviderStatus() {
        return [
            this._statusFor("gemini", "Gemini"),
            this._statusFor("openai", "ChatGPT"),
            this._statusFor("claude", "Claude")
        ];
    }

    _statusFor(name, label) {
        const rawProvider = this.providerManager.getRawProvider(name);
        const registered = !!rawProvider;
        return {
            name,
            label,
            enabled: registered,
            reason: registered ? undefined : "API key not configured",
            // Each raw provider's own .model is whatever its config file
            // resolved (env override or default - see config/openai.js /
            // config/anthropic.js / config/gemini.js) - a real configured
            // value, not a hardcoded list, since none of these backends
            // currently support picking a model per request.
            model: registered ? rawProvider.model : undefined
        };
    }

    /**
     * @param {"gemini"|"openai"|"claude"} name
     * @returns {import('./CodingModelProvider')}
     */
    getCodingProvider(name) {
        const status = this.getProviderStatus().find((p) => p.name === name);
        if (!status) {
            throw new Error(`Unknown coding provider: ${name}`);
        }
        if (!status.enabled) {
            throw new Error(`Coding provider "${status.label}" is not available: ${status.reason}`);
        }

        const rawProvider = this.providerManager.getRawProvider(name);

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
