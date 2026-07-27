const EventEmitter = require("events");
const Kernel = require("../core/Kernel");

/**
 * ==========================================
 * TTSService - Service Layer Class
 * ==========================================
 */
class TTSService extends EventEmitter {
    constructor(kernel) {
        super();
        this.kernel = kernel;
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

const wrapper = {
    setProvider: (p) => Kernel.get("ttsService").setProvider(p),
    synthesize: (opt) => Kernel.get("ttsService").synthesize(opt),
    stream: (opt) => Kernel.get("ttsService").stream(opt),
    getVoices: () => Kernel.get("ttsService").getVoices()
};

module.exports = Object.assign(wrapper, { TTSService });