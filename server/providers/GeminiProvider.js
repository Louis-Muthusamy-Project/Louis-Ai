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

        this.client = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
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