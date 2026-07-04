const path = require("path");
const fs = require("fs");

const BaseTTSProvider = require("./BaseTTSProvider");
const voiceConfig = require("../../config/voice");

class EdgeTTSProvider extends BaseTTSProvider {

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

        const filePath = output ||

            path.join(

                process.cwd(),

                "temp",

                `${Date.now()}.mp3`

            );

        fs.mkdirSync(path.dirname(filePath), {

            recursive: true

        });

        await edgeTTS.save({

            text,

            voice,

            rate: voiceConfig.rate,

            pitch: voiceConfig.pitch,

            volume: voiceConfig.volume,

            file: filePath

        });

        return {

            file: filePath,

            voice

        };

    }

    async getVoices() {

        return edgeTTS.listVoices();

    }

}

module.exports = EdgeTTSProvider;