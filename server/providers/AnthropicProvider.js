const Anthropic = require("@anthropic-ai/sdk");
const BaseAIProvider = require("./BaseAIProvider");
const anthropicConfig = require("../config/anthropic");

/**
 * ==========================================
 * AnthropicProvider
 * ------------------------------------------
 * Used ONLY by the Coding panel's ClaudeCodingProvider adapter. Not
 * constructed unconditionally by ProviderManager (Claude is optional; the
 * app must still start without an Anthropic key).
 *
 * Uses client.messages.create with native tool use - verified against the
 * installed @anthropic-ai/sdk@0.124.0 type definitions (Tool,
 * ToolUseBlock, ToolResultBlockParam), not against a live API call (no
 * network route to Anthropic's endpoints in this sandbox).
 * ==========================================
 */
class AnthropicProvider extends BaseAIProvider {
    /**
     * @param {object} [options] Explicit per-user credentials (see
     *   ProviderManager.resolveForUser). When omitted, falls back to
     *   process.env.ANTHROPIC_API_KEY for the legacy boot-time singleton
     *   path only.
     * @param {string} [options.apiKey]
     * @param {string} [options.model]
     */
    constructor(options = {}) {
        super();
        const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error("Anthropic API key is missing.");
        }
        this.client = new Anthropic({ apiKey, timeout: anthropicConfig.timeout });
        this.model = options.model || anthropicConfig.model;
    }

    getName() {
        return "claude";
    }

    /**
     * @param {string} system system instruction text
     * @param {Array} messages Anthropic Messages API message array
     * @param {Array<{name, description, parameters}>} tools plain JSON-schema tool defs
     */
    async generateWithTools(system, messages, tools) {
        const anthropicTools = tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters
        }));

        try {
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: anthropicConfig.maxOutputTokens,
                system,
                messages,
                tools: anthropicTools
            });

            if (!response) {
                throw new Error("Claude returned no response.");
            }
            return response;
        } catch (error) {
            console.error("[AnthropicProvider] generateWithTools failed:", error.message);
            throw new Error(`Claude tool-calling request failed: ${error.message}`);
        }
    }
}

module.exports = AnthropicProvider;
