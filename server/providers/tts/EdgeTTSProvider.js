const path = require("path");
const fs = require("fs");
const { MsEdgeTTS } = require("msedge-tts");

const BaseTTSProvider = require("./BaseTTSProvider");
const voiceConfig = require("../../config/voice");

/**
 * ==========================================
 * EdgeTTSProvider - Infrastructure Strategy
 * ==========================================
 */
class EdgeTTSProvider extends BaseTTSProvider {
    constructor() {
        super();
        this.tts = new MsEdgeTTS();
    }

    detectVoice(text) {
        const tamilRegex = /[\u0B80-\u0BFF]/;
        if (tamilRegex.test(text)) {
            return voiceConfig.voice.tamil;
        }
        return voiceConfig.voice.english;
    }

    async synthesize(options = {}) {
        const {
            text = "",
            output = null
        } = options;

        const voice = this.detectVoice(text);
        const filePath = output || path.join(
            process.cwd(),
            "temp",
            `${Date.now()}.mp3`
        );

        fs.mkdirSync(path.dirname(filePath), {
            recursive: true
        });

        // Initialize and save voice
        await this.tts.setMetadata(
            voice,
            voiceConfig.rate || "+0%",
            voiceConfig.pitch || "+0Hz",
            voiceConfig.volume || "+0%"
        );

        // Wait for it to write to file
        await new Promise((resolve, reject) => {
            const writable = fs.createWriteStream(filePath);
            const readable = this.tts.toStream(text);

            readable.pipe(writable);

            writable.on("finish", () => {
                resolve();
            });

            writable.on("error", (err) => {
                reject(err);
            });
        });

        return {
            file: filePath,
            voice
        };
    }

    async getVoices() {
        // msedge-tts doesn't have listVoices on instance directly sometimes, or it uses internally
        // To be safe we return the config voices
        return [voiceConfig.voice.english, voiceConfig.voice.tamil];
    }
}

module.exports = EdgeTTSProvider;