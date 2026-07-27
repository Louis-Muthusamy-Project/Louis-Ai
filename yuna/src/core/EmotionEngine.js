/**
 * ==========================================
 * EmotionEngine (Frontend Mirror)
 * ==========================================
 * Receives yuna:emotion:update payloads from
 * the server and drives the YunaEngine event
 * bus so all components react to emotion changes.
 *
 * Usage: import and call EmotionEngine.init()
 * once in App.jsx (or the socket provider).
 */
import YunaEngine from "./YunaEngine";
import SocketService from "../services/socketService";

const EMOTION_UPDATE_EVENT = "yuna:emotion:update";

class EmotionEngine {
    constructor() {
        // Current cognitive emotion state (9 axes + primary string)
        this._state = {
            joy:        0.5,
            stress:     0.1,
            trust:      0.5,
            attachment: 0.3,
            confidence: 0.6,
            curiosity:  0.5,
            energy:     0.7,
            focus:      0.5,
            mood:       0.0,
            primary:    "neutral",
            timestamp:  null
        };

        this._initialized = false;
    }

    /**
     * Call once after SocketService.connect().
     * Subscribes to server emotion updates.
     */
    init() {
        if (this._initialized) return;
        this._initialized = true;

        SocketService.on(EMOTION_UPDATE_EVENT, (data) => {
            this._handleUpdate(data);
        });
    }

    _handleUpdate(data) {
        if (!data) return;

        this._state = {
            joy:        data.joy        ?? this._state.joy,
            stress:     data.stress     ?? this._state.stress,
            trust:      data.trust      ?? this._state.trust,
            attachment: data.attachment ?? this._state.attachment,
            confidence: data.confidence ?? this._state.confidence,
            curiosity:  data.curiosity  ?? this._state.curiosity,
            energy:     data.energy     ?? this._state.energy,
            focus:      data.focus      ?? this._state.focus,
            mood:       data.mood       ?? this._state.mood,
            primary:    data.primary    ?? this._state.primary,
            timestamp:  data.timestamp  ?? new Date().toISOString()
        };

        // Emit to all React consumers via YunaEngine bus
        YunaEngine.emit("emotion", this._state);

        // Also update the behaviour state (legacy character state machine compat)
        // Only change to an emotion state if not currently in an active transition
        const current = YunaEngine.getState();
        if (current !== "thinking" && current !== "talking") {
            const mapped = this._toCharacterState(this._state.primary);
            if (mapped) YunaEngine.setState(mapped);
        }
    }

    _toCharacterState(primary) {
        const MAP = {
            happy:   "happy",
            excited: "excited",
            sad:     "sad",
            angry:   "angry",
            anxious: "confused",
            curious: "happy",   // slight smile
            focused: "idle",
            neutral: "idle"
        };
        return MAP[primary] || null;
    }

    /**
     * Returns a snapshot of the current state.
     */
    getState() {
        return { ...this._state };
    }

    /**
     * Maps current emotion axes to Framer Motion animation props.
     * Use these values directly in CharacterPanel animate={} blocks.
     */
    getAnimationProps() {
        const s = this._state;
        return {
            // Scale: breathe harder when excited/talking (energy)
            breathScale: 1 + (s.energy - 0.5) * 0.4,
            // Bounce amplitude: joy drives idle bob
            bobAmplitude: s.primary === "excited" ? 8
                : s.joy > 0.65 ? 5
                : 3,
            // Rotate (happy wiggle, stress twitch)
            rotateAmplitude: s.primary === "excited" ? 4
                : s.joy > 0.65 ? 2
                : s.stress > 0.5 ? 1
                : 0,
            // Scale on state
            characterScale: s.primary === "excited" ? 1.05
                : s.energy > 0.7 ? 1.03
                : 1.0,
            // Glow opacity driven by energy + joy
            glowOpacity: Math.min(0.8, 0.3 + s.energy * 0.3 + s.joy * 0.2),
        };
    }
}

export default new EmotionEngine();
