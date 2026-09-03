const { GoogleGenAI } = require("@google/genai");
const BaseAIProvider = require("./BaseAIProvider");
const geminiConfig = require("../config/gemini");

/**
 * ==========================================
 * GeminiProvider - Strategy Class
 * ==========================================
 */
class GeminiProvider extends BaseAIProvider {
    constructor(kernel) {
        super();
        this.kernel = kernel;

        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is missing.");
        }

        const timeoutMs = geminiConfig.timeout || 30000;

        this.client = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { timeout: timeoutMs }
        });

        this.model = geminiConfig.model;
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
                model: geminiConfig.imageModel,
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
                    `(${geminiConfig.imageModel}) may not be enabled for this API key, ` +
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