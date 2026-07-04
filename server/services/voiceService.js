/**
 * ==========================================
 * Voice Service
 * ------------------------------------------
 * Handles:
 * - Voice Queue
 * - Voice State
 * - TTS Provider (Future)
 * - Voice Interrupt
 * ==========================================
 */

const EventEmitter = require("events");
const EdgeTTSProvider = require("../providers/tts/EdgeTTSProvider");
const TTSService = require("./ttsService");

TTSService.setProvider(new EdgeTTSProvider());

class VoiceService extends EventEmitter {

    constructor() {

        super();

        this.queue = [];

        this.isSpeaking = false;

        this.currentText = "";

    }

    isBusy() {

        return this.isSpeaking;

    }

    getCurrentText() {

        return this.currentText;

    }

    enqueue(text) {

        if (!text) return;

        this.queue.push(text);

    }

    async speak(text) {

        this.currentText = text;

        this.isSpeaking = true;

        this.emit("voice:start", {

            text

        });

        const audio = await TTSService.synthesize({

            text

        });

        this.emit("voice:audio", {

            text,

            audio

        });

        this.emit("voice:end", {

            text

        });

        this.currentText = "";

        this.isSpeaking = false;

    }

    async playQueue() {

        while (this.queue.length) {

            const text = this.queue.shift();

            await this.speak(text);

        }

    }

    stop() {

        this.queue = [];

        this.currentText = "";

        this.isSpeaking = false;

        this.emit("voice:stop");

    }

    clearQueue() {

        this.queue = [];

    }

    delay(ms) {

        return new Promise(resolve => {

            setTimeout(resolve, ms);

        });

    }

}

module.exports = new VoiceService();