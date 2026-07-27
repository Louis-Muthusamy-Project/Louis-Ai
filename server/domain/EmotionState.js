/**
 * ==========================================
 * EmotionState - Domain Value Object
 * ==========================================
 * Represents Yuna's full emotional state
 * across 9 continuous cognitive axes.
 * All axes are clamped to their valid range.
 */
class EmotionState {
    constructor(data = {}) {
        // Primary affect axes [0..1]
        this.joy        = this._clamp(data.joy        ?? 0.5, 0, 1);
        this.stress     = this._clamp(data.stress     ?? 0.1, 0, 1);
        this.trust      = this._clamp(data.trust      ?? 0.5, 0, 1);
        this.attachment = this._clamp(data.attachment ?? 0.3, 0, 1);
        this.confidence = this._clamp(data.confidence ?? 0.6, 0, 1);
        this.curiosity  = this._clamp(data.curiosity  ?? 0.5, 0, 1);
        this.energy     = this._clamp(data.energy     ?? 0.7, 0, 1);
        this.focus      = this._clamp(data.focus      ?? 0.5, 0, 1);
        // Overall valence [-1..1]
        this.mood       = this._clamp(data.mood       ?? 0.0, -1, 1);

        this.timestamp = data.timestamp || new Date().toISOString();
    }

    _clamp(v, min, max) {
        return Math.max(min, Math.min(max, Number(v) || 0));
    }

    /**
     * Apply named deltas without clamping the axes beyond their ranges.
     * Returns a NEW EmotionState (immutable update pattern).
     */
    applyDeltas(deltas = {}) {
        return new EmotionState({
            joy:        this.joy        + (deltas.joy        || 0),
            stress:     this.stress     + (deltas.stress     || 0),
            trust:      this.trust      + (deltas.trust      || 0),
            attachment: this.attachment + (deltas.attachment || 0),
            confidence: this.confidence + (deltas.confidence || 0),
            curiosity:  this.curiosity  + (deltas.curiosity  || 0),
            energy:     this.energy     + (deltas.energy     || 0),
            focus:      this.focus      + (deltas.focus      || 0),
            mood:       this.mood       + (deltas.mood       || 0),
        });
    }

    /**
     * Decay axes toward their resting baselines.
     * Rate is expressed as change-per-second.
     */
    decay(deltaSeconds = 5) {
        const lerp = (v, target, rate) => v + (target - v) * rate * deltaSeconds;
        return new EmotionState({
            joy:        lerp(this.joy,        0.5,  0.01),
            stress:     lerp(this.stress,     0.0,  0.02),
            trust:      this.trust,              // held; relationship events only
            attachment: this.attachment,         // held; relationship events only
            confidence: lerp(this.confidence, 0.6,  0.005),
            curiosity:  lerp(this.curiosity,  0.5,  0.03),
            energy:     lerp(this.energy,     0.7,  0.005),
            focus:      lerp(this.focus,      0.5,  0.025),
            mood:       lerp(this.mood,       0.0,  0.01),
        });
    }

    /**
     * Blend this state with another (linear interpolation).
     * weight=0 → this, weight=1 → other
     */
    blend(other, weight = 0.5) {
        const w = this._clamp(weight, 0, 1);
        const lerp = (a, b) => a + (b - a) * w;
        return new EmotionState({
            joy:        lerp(this.joy,        other.joy),
            stress:     lerp(this.stress,     other.stress),
            trust:      lerp(this.trust,      other.trust),
            attachment: lerp(this.attachment, other.attachment),
            confidence: lerp(this.confidence, other.confidence),
            curiosity:  lerp(this.curiosity,  other.curiosity),
            energy:     lerp(this.energy,     other.energy),
            focus:      lerp(this.focus,      other.focus),
            mood:       lerp(this.mood,       other.mood),
        });
    }

    /**
     * Derive the dominant named emotion from the axis values.
     * Used for backward-compatible string emotion returns.
     */
    toPrimaryEmotion() {
        const { joy, stress, curiosity, energy, focus, mood } = this;

        if (stress > 0.65)          return "anxious";
        if (joy > 0.75 && energy > 0.7) return "excited";
        if (joy > 0.65)             return "happy";
        if (mood < -0.4)            return "sad";
        if (stress > 0.45 && mood < -0.2) return "angry";
        if (curiosity > 0.7)        return "curious";
        if (focus > 0.7)            return "focused";
        if (focus < 0.3 && stress > 0.3) return "confused";
        return "neutral";
    }

    /**
     * Serialize to a compact object for JSON emission to frontend.
     */
    toSummary() {
        return {
            joy:        Math.round(this.joy * 100) / 100,
            stress:     Math.round(this.stress * 100) / 100,
            trust:      Math.round(this.trust * 100) / 100,
            attachment: Math.round(this.attachment * 100) / 100,
            confidence: Math.round(this.confidence * 100) / 100,
            curiosity:  Math.round(this.curiosity * 100) / 100,
            energy:     Math.round(this.energy * 100) / 100,
            focus:      Math.round(this.focus * 100) / 100,
            mood:       Math.round(this.mood * 100) / 100,
            primary:    this.toPrimaryEmotion(),
            timestamp:  this.timestamp
        };
    }

    /**
     * Format a natural-language summary for prompt injection.
     */
    toPromptSummary() {
        const moodLabel  = this.mood > 0.3 ? "positive" : this.mood < -0.3 ? "negative" : "balanced";
        const energyLabel = this.energy > 0.7 ? "high" : this.energy < 0.4 ? "low" : "moderate";
        const stressLabel = this.stress > 0.6 ? "high" : this.stress < 0.2 ? "calm" : "mild";
        const curiosityLabel = this.curiosity > 0.65 ? "highly engaged" : this.curiosity < 0.35 ? "disengaged" : "interested";

        return [
            `Primary Emotion: ${this.toPrimaryEmotion()}`,
            `Mood: ${this.mood.toFixed(2)} (${moodLabel})`,
            `Energy: ${this.energy.toFixed(2)} (${energyLabel})`,
            `Curiosity: ${this.curiosity.toFixed(2)} (${curiosityLabel})`,
            `Stress: ${this.stress.toFixed(2)} (${stressLabel})`,
            `Trust: ${this.trust.toFixed(2)}`,
            `Confidence: ${this.confidence.toFixed(2)}`,
            `Focus: ${this.focus.toFixed(2)}`
        ].join("\n");
    }

    /**
     * Map axes to Live2D parameter overrides.
     * Returns an object of { paramName: value } deltas.
     */
    toLive2DParams() {
        return {
            // ParamAngleX: head tilt (curiosity drives slight tilt)
            ParamAngleX: (this.curiosity - 0.5) * 20,
            // ParamAngleY: head nod (joy drives slight upward look)
            ParamAngleY: (this.joy - 0.4) * 15,
            // ParamEyeOpenL/R: wider eyes when excited/curious
            ParamEyeOpenL: 0.7 + this.curiosity * 0.3,
            ParamEyeOpenR: 0.7 + this.curiosity * 0.3,
            // ParamBrowLY/RY: stress raises brows
            ParamBrowLY: this.stress * 0.6 - this.joy * 0.2,
            ParamBrowRY: this.stress * 0.6 - this.joy * 0.2,
            // ParamMouthOpenY: talking and excitement
            ParamMouthOpenY: this.energy * 0.4,
            // ParamBodyAngleX: gentle sway (energy)
            ParamBodyAngleX: (this.energy - 0.5) * 10,
            // Breath scale hint (used by CharacterPanel)
            breathScale: 1 + (this.energy - 0.5) * 0.3
        };
    }
}

module.exports = EmotionState;
