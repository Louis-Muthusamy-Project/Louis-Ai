const EventEmitter = require("events");

class TTSService extends EventEmitter {

    constructor() {

        super();

        this.provider = null;

    }

    setProvider(provider) {

        this.provider = provider;

    }

    async synthesize(options = {}) {

        if (!this.provider) {
            throw new Error("TTS Provider not configured.");
        }

        return this.provider.synthesize(options);

    }

    async stream(options = {}) {

        if (!this.provider) {
            throw new Error("TTS Provider not configured.");
        }

        return this.provider.stream(options);

    }

    async getVoices() {

        if (!this.provider) {
            return [];
        }

        return this.provider.getVoices();

    }

}

module.exports = new TTSService();