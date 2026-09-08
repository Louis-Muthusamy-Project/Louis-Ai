const { GoogleGenAI } = require("@google/genai");
const BaseAIProvider = require("./BaseAIProvider");
const geminiConfig = require("../config/gemini");

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

    /**

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
            console.error("[GeminiProvider] generateWithTools failed:", error);
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