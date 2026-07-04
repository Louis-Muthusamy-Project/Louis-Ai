const GeminiProvider = require("./GeminiProvider");

class ProviderManager {

    constructor() {

        this.providers = {

            gemini: new GeminiProvider()

        };

        this.activeProvider = process.env.AI_PROVIDER || "gemini";

        if (!this.providers[this.activeProvider]) {

            console.warn(

                `[ProviderManager] Unknown provider "${this.activeProvider}". Falling back to Gemini.`

            );

            this.activeProvider = "gemini";

        }

    }

    get provider() {

        return this.providers[this.activeProvider];

    }

    getProviderName() {

        return this.provider.getName();

    }

    setProvider(name) {

        if (!this.providers[name]) {

            throw new Error(`Unknown AI provider: ${name}`);

        }

        this.activeProvider = name;

    }

    register(name, provider) {

        if (!name || !provider) {

            throw new Error("Invalid provider registration.");

        }

        this.providers[name] = provider;

    }

    async generate(contents) {

        return this.provider.generate(contents);

    }

    async stream(contents, callbacks = {}) {

        if (typeof this.provider.stream === "function") {

            return this.provider.stream(

                contents,

                callbacks

            );

        }

        /**
         * Fallback
         */

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

module.exports = new ProviderManager();