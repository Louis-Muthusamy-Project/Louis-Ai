/**
 * ==========================================
 * Emotion - Domain Value Object & Evaluator
 * ==========================================
 */
class Emotion {
    constructor() {
        this.rules = {
            happy: ["happy", "glad", "awesome", "great", "yay", "love", "😊", "😄", "😁", "❤️"],
            sad: ["sad", "sorry", "miss", "cry", "😭", "😢"],
            excited: ["wow", "amazing", "fantastic", "excited", "🔥", "✨", "🤩"],
            angry: ["angry", "annoy", "hate", "😠", "😡"],
            confused: ["confused", "don't understand", "not sure", "🤔"]
        };
    }

    /**
     * Identifies emotional state matching string patterns
     */
    detect(text = "") {
        const lower = text.toLowerCase();
        for (const emotion of Object.keys(this.rules)) {
            const triggers = this.rules[emotion];
            for (const trigger of triggers) {
                if (lower.includes(trigger.toLowerCase())) {
                    return emotion;
                }
            }
        }
        return "neutral";
    }

    /**
     * Map emotional state to Live2D animation model mappings
     */
    getAnimation(emotion) {
        switch (emotion) {
            case "happy": return "smile";
            case "excited": return "excited";
            case "sad": return "sad";
            case "angry": return "angry";
            case "confused": return "thinking";
            default: return "idle";
        }
    }

    /**
     * Map emotional state to voice synthesis tone variations
     */
    getVoiceTone(emotion) {
        switch (emotion) {
            case "happy": return "cheerful";
            case "excited": return "energetic";
            case "sad": return "soft";
            case "angry": return "firm";
            case "confused": return "thinking";
            default: return "normal";
        }
    }
}

module.exports = new Emotion();
