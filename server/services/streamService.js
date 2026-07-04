const EventEmitter = require("events");

class StreamService extends EventEmitter {

    constructor() {
        super();
    }

    /**
     * Stream text word-by-word.
     * Later this will be replaced with
     * native Gemini streaming.
     */
    async stream(text, callbacks = {}) {

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

            const words = text.split(/\s+/);

            let currentText = "";

            for (const word of words) {

                currentText += (currentText ? " " : "") + word;

                if (typeof onChunk === "function") {

                    await onChunk({
                        chunk: word,
                        fullText: currentText,
                        done: false
                    });

                }

                const speed = callbacks.speed ?? 35;

                await this.delay(speed);

            }

            if (typeof onComplete === "function") {

                await onComplete({
                    text: currentText,
                    done: true
                });

            }

            return currentText;

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

module.exports = new StreamService();