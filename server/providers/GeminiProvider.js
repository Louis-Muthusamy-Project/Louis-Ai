const { GoogleGenAI } = require("@google/genai");
const BaseAIProvider = require("./BaseAIProvider");
const geminiConfig = require("../config/gemini");

class GeminiProvider extends BaseAIProvider {

    constructor() {

        super();

        this.client = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });

        this.model = geminiConfig.model;

    }

    getName() {
        return "gemini";
    }

    async generate(contents) {

        const response = await this.client.models.generateContent({

            model: this.model,

            contents,

            config: geminiConfig.generationConfig

        });

        return response.text || "";

    }

    async stream(contents, callbacks = {}) {

        /**
         * Temporary implementation.
         * Next step will replace this with
         * Gemini native streaming.
         */

        const text = await this.generate(contents);

        if (callbacks.onStart) {
            await callbacks.onStart();
        }

        const words = text.split(/\s+/);

        let current = "";

        for (const word of words) {

            current += (current ? " " : "") + word;

            if (callbacks.onChunk) {

                await callbacks.onChunk({

                    chunk: word,

                    fullText: current,

                    done: false

                });

            }

        }

        if (callbacks.onComplete) {

            await callbacks.onComplete({

                text: current,

                done: true

            });

        }

        return current;

    }

}

module.exports = GeminiProvider;