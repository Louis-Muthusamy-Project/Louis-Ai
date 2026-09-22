const { GoogleGenAI } = require("@google/genai");
const BaseAIProvider = require("./BaseAIProvider");
const geminiConfig = require("../config/gemini");

/**
 * ==========================================
 * GeminiProvider - Strategy Class
 * ==========================================
 */
class GeminiProvider extends BaseAIProvider {
    /**
     * @param {object} options Explicit, required credential/config - this
     *   provider NEVER reads process.env itself. Callers (only
     *   ProviderManager.resolveForUser) must resolve ONE user's own
     *   decrypted credential first and pass it in here.
     * @param {string} options.apiKey Required. No environment fallback.
     * @param {string} [options.model]
     * @param {string} [options.imageModel]
     */
    constructor(options = {}) {
        super();

        const apiKey = options.apiKey;
        if (!apiKey) {
            throw new Error("Gemini API key is missing. GeminiProvider must be constructed with an explicit apiKey - it never reads environment variables.");
        }

        const timeoutMs = geminiConfig.timeout || 30000;

        this.client = new GoogleGenAI({
            apiKey,
            httpOptions: { timeout: timeoutMs }
        });

        this.model = options.model || geminiConfig.model;
        this.imageModel = options.imageModel || geminiConfig.imageModel;
        // Retained ONLY for listModels()'s direct REST call below - the
        // @google/genai SDK (installed version) has no public models.list()
        // method (only an internal/private one this codebase will not call,
        // since that's unstable, unsupported API surface), so listing uses
        // Google's own documented public REST endpoint instead. Never
        // logged, never returned to the frontend.
        this._apiKey = apiKey;
    }

    /**
     * Real, live list of this key's actually-available Gemini models -
     * never a hardcoded/guessed catalog. Uses Google's public REST
     * endpoint directly (see this._apiKey's comment for why: no SDK
     * wrapper for it in the installed @google/genai version).
     */
    async listModels() {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(this._apiKey)}`
        );
        if (!response.ok) {
            const body = await response.text().catch(() => "");
            throw new Error(`Could not list Gemini models (${response.status}): ${body.slice(0, 200)}`);
        }
        const data = await response.json();
        return (data.models || [])
            .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
            .map(m => ({
                id: (m.name || "").replace(/^models\//, ""),
                label: m.displayName || (m.name || "").replace(/^models\//, "")
            }))
            .filter(m => m.id);
    }

    getName() {
        return "gemini";
    }

    async generate(contents) {
        try {
            const response = await this.client.models.generateContent({
                model: this.model,
                contents,
                config: geminiConfig.generationConfig
            });

            if (!response) {
                throw new Error("Gemini returned no response.");
            }

            const text = response.text?.trim();

            if (!text) {
                throw new Error("Gemini returned an empty response.");
            }

            return text;
        } catch (error) {
            console.error("[GeminiProvider]", error);
            throw new Error("Unable to generate AI response.");
        }
    }

    async stream(contents, callbacks = {}) {
        const {
            onStart,
            onChunk,
            onComplete,
            onError
        } = callbacks;

        try {
            if (typeof onStart === "function") {
                await onStart();
            }

            // Native streaming via Google Gen AI SDK
            const responseStream = await this.client.models.generateContentStream({
                model: this.model,
                contents,
                config: geminiConfig.generationConfig
            });

            let current = "";

            for await (const chunk of responseStream) {
                const chunkText = chunk.text;
                if (chunkText) {
                    current += chunkText;
                    if (typeof onChunk === "function") {
                        await onChunk({
                            chunk: chunkText,
                            fullText: current,
                            done: false
                        });
                    }
                }
            }

            if (typeof onComplete === "function") {
                await onComplete({
                    text: current,
                    done: true
                });
            }

            return current;
        } catch (error) {
            if (typeof onError === "function") {
                await onError(error);
            }
            throw error;
        }
    }

    /**
     * Generates an image from a text prompt using the configured
     * image-capable Gemini model (see config/gemini.js: imageModel).
     * Uses the SAME generateContent() call shape as normal text
     * generation - just with responseModalities including "IMAGE" and a
     * different model - so this doesn't require a second SDK client or
     * separate auth. Confirmed against the installed @google/genai
     * version's type definitions (generateContent's config accepts
     * responseModalities and its response parts can contain inlineData);
     * NOT verified against a live API call, since this sandbox has no
     * network access to Google's endpoints. Whether the configured
     * GEMINI_API_KEY actually has this model enabled needs a real request
     * in an environment with network access.
     *
     * @param {string} prompt
     * @returns {Promise<{data: string, mimeType: string}>} base64 image data - never written to disk
     */
    async generateImage(prompt) {
        if (!prompt || !prompt.trim()) {
            throw new Error("Cannot generate an image from an empty prompt.");
        }

        try {
            const response = await this.client.models.generateContent({
                model: this.imageModel,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    responseModalities: ["TEXT", "IMAGE"]
                }
            });

            const parts = response?.candidates?.[0]?.content?.parts || [];
            const imagePart = parts.find(p => p.inlineData && p.inlineData.data);

            if (!imagePart) {
                throw new Error(
                    "Gemini did not return image data. The configured model " +
                    `(${this.imageModel}) may not be enabled for this API key, ` +
                    "or the request may have been blocked by safety filters."
                );
            }

            return {
                data: imagePart.inlineData.data, // base64 - caller decides what to do with it, never written to disk here
                mimeType: imagePart.inlineData.mimeType || "image/png"
            };
        } catch (error) {
            console.error("[GeminiProvider] Image generation failed:", error.message);
            throw new Error("Unable to generate image.");
        }
    }

    /**
     * Native function/tool calling for the coding agent (see
     * server/services/coding/GeminiCodingProvider.js). Reuses this same
     * client/model rather than creating a second GoogleGenAI instance.
     *
     * `contents` is the full turn history (Content[] - some with role
     * "model" containing functionCall parts, some with role "user"
     * containing functionResponse parts, per Gemini's manual multi-turn
     * function-calling convention). `tools` is an array of
     * {name, description, parameters} (plain JSON Schema - see
     * codingToolDefinitions.js), converted here to the SDK's
     * `{functionDeclarations: [...]}` shape with `parametersJsonSchema`.
     *
     * Returns the raw SDK response so the caller can read both
     * response.text and response.functionCalls (FunctionCall[]).
     *
     * NOTE ON VERIFICATION: this method's request/response shape is
     * verified against @google/genai@2.10.0's shipped type definitions
     * (FunctionDeclaration.parametersJsonSchema, FunctionCallingConfigMode,
     * response.functionCalls) - it has NOT been exercised against a live
     * Gemini API call, since this sandbox has no network access to
     * Google's endpoints. Treat as structurally correct, not
     * live-verified, until run with a real GEMINI_API_KEY.
     *
     * @param {Array} contents
     * @param {Array<{name:string, description:string, parameters:object}>} tools
     * @param {{mode?: "AUTO"|"ANY"|"NONE"}} [toolConfig]
     */
    async generateWithTools(contents, tools, toolConfig = {}) {
        const { FunctionCallingConfigMode } = require("@google/genai");

        const functionDeclarations = tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parametersJsonSchema: tool.parameters
        }));

        const modeMap = {
            AUTO: FunctionCallingConfigMode.AUTO,
            ANY: FunctionCallingConfigMode.ANY,
            NONE: FunctionCallingConfigMode.NONE
        };

        try {
            const response = await this.client.models.generateContent({
                model: this.model,
                contents,
                config: {
                    ...geminiConfig.generationConfig,
                    tools: [{ functionDeclarations }],
                    toolConfig: {
                        functionCallingConfig: {
                            mode: modeMap[toolConfig.mode] || FunctionCallingConfigMode.AUTO
                        }
                    }
                }
            });

            if (!response) {
                throw new Error("Gemini returned no response.");
            }

            return response;
        } catch (error) {
            console.error("[GeminiProvider] generateWithTools failed:", error.message);
            throw new Error(`Gemini tool-calling request failed: ${error.message}`);
        }
    }

    async embed(text) {
        try {
            if (!text || !text.trim()) {
                throw new Error("Cannot embed empty text.");
            }
            // gemini-embedding-001 response shape: { embeddings: [{ values: float[] }] }
            const response = await this.client.models.embedContent({
                model: "gemini-embedding-001",
                contents: text
            });

            if (
                response &&
                Array.isArray(response.embeddings) &&
                response.embeddings.length > 0 &&
                Array.isArray(response.embeddings[0].values)
            ) {
                return response.embeddings[0].values;
            }
            throw new Error("Embedding response is missing vector values.");
        } catch (error) {
            console.error("[GeminiProvider] Embedding generation failed:", error.message);
            throw error;
        }
    }

    delay(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }
}

module.exports = GeminiProvider;