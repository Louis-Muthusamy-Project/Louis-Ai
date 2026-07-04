const { GoogleGenAI } = require("@google/genai");
const BaseAIProvider = require("./BaseAIProvider");
const geminiConfig = require("../config/gemini");

class GeminiProvider extends BaseAIProvider {

    constructor() {

        super();

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

        }

        catch (error) {

            console.error("[GeminiProvider]", error);

            throw new Error(

                "Unable to generate AI response."

            );

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

            const text = await this.generate(contents);

            if (typeof onStart === "function") {

                await onStart();

            }

            const words = text.split(/\s+/);

            let current = "";

            for (const word of words) {

                current += (current ? " " : "") + word;

                if (typeof onChunk === "function") {

                    await onChunk({

                        chunk: word,

                        fullText: current,

                        done: false

                    });

                }

                await this.delay(30);

            }

            if (typeof onComplete === "function") {

                await onComplete({

                    text: current,

                    done: true

                });

            }

            return current;

        }

        catch (error) {

            if (typeof onError === "function") {

                await onError(error);

            }

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