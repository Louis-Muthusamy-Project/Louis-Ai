const OpenAI = require("openai");
const BaseAIProvider = require("./BaseAIProvider");
const openaiConfig = require("../config/openai");

/**
 * ==========================================
 * OpenAIProvider
 * ------------------------------------------
 * Used ONLY by the Coding panel's OpenAICodingProvider adapter - Yuna's
 * Chat/Character tabs are Gemini-only and never touch this class. Unlike
 * GeminiProvider, this is NOT constructed unconditionally by ProviderManager
 * (OpenAI is optional; the app must still start without an OpenAI key) -
 * see ProviderManager's conditional registration.
 *
 * Uses the Responses API (client.responses.create), which is what the
 * installed openai@7.10.0 SDK's own README documents as "the primary API
 * for interacting with OpenAI models" and which supports native
 * function/tool calling - verified against the SDK's shipped type
 * definitions (FunctionTool, ResponseFunctionToolCall,
 * ResponseInputItem.FunctionCallOutput), not against a live API call (no
 * network route to OpenAI's endpoints in this sandbox).
 * ==========================================
 */
class OpenAIProvider extends BaseAIProvider {
    /**
     * @param {object} options Explicit, required credential/config - this
     *   provider NEVER reads process.env itself (see
     *   ProviderManager.resolveForUser).
     * @param {string} options.apiKey Required. No environment fallback.
     * @param {string} [options.model]
     */
    constructor(options = {}) {
        super();
        const apiKey = options.apiKey;
        if (!apiKey) {
            throw new Error("OpenAI API key is missing. OpenAIProvider must be constructed with an explicit apiKey - it never reads environment variables.");
        }
        this.client = new OpenAI({ apiKey, timeout: openaiConfig.timeout });
        this.model = options.model || openaiConfig.model;
    }

    /**
     * Real, live list of this key's actually-available OpenAI models -
     * via the SDK's own documented models.list() (verified against the
     * SDK's shipped type definitions, not a live call - no network route
     * to OpenAI's endpoints in this sandbox). Filtered to chat/reasoning-
     * capable model families only (excludes embeddings/tts/whisper/
     * dall-e/moderation entries the same endpoint also returns, which
     * are not valid choices for the Coding Agent).
     */
    async listModels() {
        const list = await this.client.models.list();
        return (list.data || [])
            .filter(m => /^(gpt-|o[0-9]|chatgpt-)/i.test(m.id))
            .map(m => ({ id: m.id, label: m.id }))
            .sort((a, b) => a.id.localeCompare(b.id));
    }

    getName() {
        return "openai";
    }

    /**
     * @param {string} instructions system instruction text
     * @param {Array} input Responses API input item array
     * @param {Array<{name, description, parameters}>} tools plain JSON-schema tool defs
     */
    async generateWithTools(instructions, input, tools) {
        const functionTools = tools.map((tool) => ({
            type: "function",
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            strict: false
        }));

        try {
            const response = await this.client.responses.create({
                model: this.model,
                instructions,
                input,
                tools: functionTools,
                tool_choice: "auto",
                max_output_tokens: openaiConfig.maxOutputTokens
            });

            if (!response) {
                throw new Error("OpenAI returned no response.");
            }
            return response;
        } catch (error) {
            console.error("[OpenAIProvider] generateWithTools failed:", error.message);
            throw new Error(`OpenAI tool-calling request failed: ${error.message}`);
        }
    }
}

module.exports = OpenAIProvider;
