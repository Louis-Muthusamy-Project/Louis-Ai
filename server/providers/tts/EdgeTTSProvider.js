const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const BaseTTSProvider = require("./BaseTTSProvider");
const voiceConfig = require("../../config/voice");

/**
 * ==========================================
 * EdgeTTSProvider - Infrastructure Strategy
 * ------------------------------------------
 * Synthesizes speech fully in memory - no temp files are ever written
 * to disk. Previously this wrote every response to server/temp/*.mp3
 * and never cleaned it up; on top of that, toStream() was called
 * without awaiting it (it returns a Promise) and setMetadata() was
 * called with the wrong argument shape (rate/pitch/volume passed as
 * if they were metadata options, when they're actually prosody
 * options for toStream()) - between the two, synthesis reliably threw
 * before producing usable audio while still leaving an empty file
 * behind. Both are fixed here.
 * ==========================================
 */
class EdgeTTSProvider extends BaseTTSProvider {
    constructor() {
        super();
        this.tts = new MsEdgeTTS();
    }

    /**
     * Supported languages are exactly English, Tamil, and Japanese.
     * Japanese must never silently fall back to English.
     *
     * Dominant-script selection: counts Tamil/Japanese/Latin characters
     * and picks whichever script has the most. This is a deliberate,
     * documented approximation - the underlying TTS engine synthesizes
     * the whole string with ONE voice, so true per-word/per-sentence
     * multilingual audio would require splitting text into
     * language-homogeneous spans and synthesizing/concatenating each
     * separately, which this does not attempt. On a tie between a
     * script-based language (Tamil/Japanese) and Latin character count,
     * the script-based language wins - a short greeting plus an embedded
     * English/Latin proper noun (e.g. "こんにちは Louis") shouldn't flip
     * the whole utterance to English just because the name is Latin-script.
     */
    detectVoice(text) {
        if (!text) return voiceConfig.voice.english;

        const tamilCount = (text.match(/[\u0B80-\u0BFF]/g) || []).length;
        const japaneseCount = (text.match(/[\u3040-\u30FF\u31F0-\u31FF\u4E00-\u9FFF]/g) || []).length;
        const latinCount = (text.match(/[A-Za-z]/g) || []).length;

        if (tamilCount === 0 && japaneseCount === 0) {
            return voiceConfig.voice.english;
        }

        const scriptCount = Math.max(tamilCount, japaneseCount);
        const scriptVoice = tamilCount >= japaneseCount ? voiceConfig.voice.tamil : voiceConfig.voice.japanese;

        return scriptCount >= latinCount ? scriptVoice : voiceConfig.voice.english;
    }

    async synthesize(options = {}) {
        const { text = "" } = options;
        const voice = this.detectVoice(text);

        await this.tts.setMetadata(
            voice,
            OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
        );

        const { audioStream } = await this.tts.toStream(text, {
            rate: voiceConfig.rate || "+0%",
            pitch: voiceConfig.pitch || "+0Hz",
            volume: voiceConfig.volume || "+0%"
        });

        const audio = await new Promise((resolve, reject) => {
            const chunks = [];
            audioStream.on("data", (chunk) => chunks.push(chunk));
            audioStream.on("end", () => resolve(Buffer.concat(chunks)));
            audioStream.on("error", reject);
        });

        if (!audio || audio.length === 0) {
            throw new Error(`EdgeTTSProvider produced empty audio for voice ${voice}.`);
        }

        return {
            audio,               // raw MP3 bytes, in memory only - never written to disk
            mimeType: "audio/mpeg",
            voice
        };
    }

    async getVoices() {
        // msedge-tts's own getVoices() calls Microsoft's live API; we
        // deliberately don't proxy that here to avoid an unbounded remote
        // call on every request. Return the small, fixed configured set.
        return [voiceConfig.voice.english, voiceConfig.voice.tamil, voiceConfig.voice.japanese];
    }
}

module.exports = EdgeTTSProvider;
