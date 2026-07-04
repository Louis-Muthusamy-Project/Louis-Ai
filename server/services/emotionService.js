/**
 * ==========================================
 * Emotion Service
 * ------------------------------------------
 * Detects Yuna's emotional state from
 * generated responses.
 * ==========================================
 */

class EmotionService {

    constructor() {

        this.rules = {

            happy: [
                "happy",
                "glad",
                "awesome",
                "great",
                "yay",
                "love",
                "😊",
                "😄",
                "😁",
                "❤️"
            ],

            sad: [
                "sad",
                "sorry",
                "miss",
                "cry",
                "😭",
                "😢"
            ],

            excited: [
                "wow",
                "amazing",
                "fantastic",
                "excited",
                "🔥",
                "✨",
                "🤩"
            ],

            angry: [
                "angry",
                "annoy",
                "hate",
                "😠",
                "😡"
            ],

            confused: [
                "confused",
                "don't understand",
                "not sure",
                "🤔"
            ]
        };

    }

    detect(text = "") {

        const lower = text.toLowerCase();

        for (const emotion of Object.keys(this.rules)) {

            const words = this.rules[emotion];

            for (const word of words) {

                if (lower.includes(word.toLowerCase())) {
                    return emotion;
                }

            }

        }

        return "neutral";

    }

    getAnimation(emotion) {

        switch (emotion) {

            case "happy":
                return "smile";

            case "excited":
                return "excited";

            case "sad":
                return "sad";

            case "angry":
                return "angry";

            case "confused":
                return "thinking";

            default:
                return "idle";

        }

    }

    getVoiceTone(emotion) {

        switch (emotion) {

            case "happy":
                return "cheerful";

            case "excited":
                return "energetic";

            case "sad":
                return "soft";

            case "angry":
                return "firm";

            case "confused":
                return "thinking";

            default:
                return "normal";

        }

    }

}

module.exports = new EmotionService();