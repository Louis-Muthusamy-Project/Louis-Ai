const Emotion = require("../domain/Emotion");
const Kernel = require("../core/Kernel");

/**
 * ==========================================
 * EmotionService - Refactored Service Class
 * ==========================================
 */
class EmotionService {
    constructor(kernel) {
        this.kernel = kernel;
    }

    detect(text = "") {
        return Emotion.detect(text);
    }

    getAnimation(emotion) {
        return Emotion.getAnimation(emotion);
    }

    getVoiceTone(emotion) {
        return Emotion.getVoiceTone(emotion);
    }
}

const wrapper = {
    detect: (t) => Kernel.get("emotionService").detect(t),
    getAnimation: (e) => Kernel.get("emotionService").getAnimation(e),
    getVoiceTone: (e) => Kernel.get("emotionService").getVoiceTone(e)
};

module.exports = Object.assign(wrapper, { EmotionService });