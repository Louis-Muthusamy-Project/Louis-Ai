const EmotionEngine = require("./EmotionEngine");
const Kernel = require("../core/Kernel");

/**
 * ==========================================
 * EmotionService - Refactored Service Class
 * ==========================================
 * Delegates all cognitive emotion operations
 * to EmotionEngine. Maintains backward-compat
 * wrappers (detect, getAnimation, getVoiceTone)
 * used throughout the codebase.
 */
class EmotionService {
    constructor(kernel) {
        this.kernel = kernel;
        // EmotionEngine is a singleton; reference it directly
        this.engine = EmotionEngine;
    }

    // ── Backward-compatible API (unchanged contracts) ───────────────────────

    /**
     * Detect primary emotion string from reply text.
     * Kept for legacy callers — prefers per-session state when socketId provided.
     */
    detect(text = "", socketId = null) {
        if (socketId) {
            return this.engine.getState(socketId).toPrimaryEmotion();
        }
        // Stateless fallback: apply text analysis on a fresh state
        const EmotionState = require("../domain/EmotionState");
        const fresh = new EmotionState();
        // Quick inline text scan for backwards-compat
        const lower = text.toLowerCase();
        if (/happy|glad|love|yay|awesome|great/.test(lower)) return "happy";
        if (/excited|wow|amazing|fantastic/.test(lower)) return "excited";
        if (/sad|cry|miss|sorry/.test(lower)) return "sad";
        if (/angry|hate|annoy/.test(lower)) return "angry";
        if (/confused|lost/.test(lower)) return "confused";
        return "neutral";
    }

    getAnimation(emotion) {
        const ANIMATION_MAP = {
            happy:   "smile",
            excited: "excited",
            sad:     "sad",
            angry:   "angry",
            confused:"thinking",
            anxious: "thinking",
            curious: "smile",
            focused: "idle",
            neutral: "idle"
        };
        return ANIMATION_MAP[emotion] || "idle";
    }

    getVoiceTone(emotion) {
        const TONE_MAP = {
            happy:   "cheerful",
            excited: "energetic",
            sad:     "soft",
            angry:   "firm",
            confused:"thinking",
            anxious: "soft",
            curious: "cheerful",
            focused: "normal",
            neutral: "normal"
        };
        return TONE_MAP[emotion] || "normal";
    }

    // ── New cognitive API ────────────────────────────────────────────────────

    analyzeText(socketId, text, intent = "CHAT") {
        return this.engine.analyzeText(socketId, text, intent);
    }

    getState(socketId) {
        return this.engine.getState(socketId);
    }

    getMoodHistory(socketId) {
        return this.engine.getMoodHistory(socketId);
    }

    predict(socketId) {
        return this.engine.predict(socketId);
    }

    applyRelationshipBoost(socketId, levelDelta) {
        return this.engine.applyRelationshipBoost(socketId, levelDelta);
    }

    resetSession(socketId) {
        return this.engine.reset(socketId);
    }
}

// ── Backward-compat module-level wrapper ────────────────────────────────────
const wrapper = {
    detect:     (t, sid) => Kernel.get("emotionService").detect(t, sid),
    getAnimation:(e) => Kernel.get("emotionService").getAnimation(e),
    getVoiceTone:(e) => Kernel.get("emotionService").getVoiceTone(e),
    analyzeText: (sid, t, intent) => Kernel.get("emotionService").analyzeText(sid, t, intent),
    getState:   (sid) => Kernel.get("emotionService").getState(sid),
    getMoodHistory: (sid) => Kernel.get("emotionService").getMoodHistory(sid),
    predict:    (sid) => Kernel.get("emotionService").predict(sid),
};

module.exports = Object.assign(wrapper, { EmotionService });