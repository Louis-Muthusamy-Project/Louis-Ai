/**
 * ============================================================================
 * BreathingController
 * ============================================================================
 * Generates continuous organic respiratory cycles modulating chest expansion,
 * shoulder lift, and subtle vertical offset.
 *
 * Parameters controlled:
 * - ParamBreath (0 to 1)
 * - ParamShoulder (-1 to 1)
 * - Subtle vertical model translation / scale pulse
 */

export class BreathingController {
    constructor() {
        this.phase = 0;
        this.baseFrequency = 0.25; // ~15 breaths per minute (0.25 Hz)
        this.amplitude = 1.0;
        this.breathValue = 0.0;
        this.shoulderValue = 0.0;
        this.scaleOffset = 0.0;
    }

    /**
     * Update breathing phase and calculate parameter values.
     * @param {number} deltaSeconds - Delta time in seconds
     * @param {object} emotionState - 9-axis emotion state
     */
    update(deltaSeconds, emotionState = {}) {
        const { primary, energy = 0.5, stress = 0.1 } = emotionState;

        // Dynamic rate and depth calculation based on emotional state
        let targetFreq = this.baseFrequency;
        let targetAmp = 1.0;

        if (primary === "excited" || energy > 0.75) {
            // Rapid, energetic breathing
            targetFreq = 0.42; // ~25 bpm
            targetAmp = 1.15;
        } else if (primary === "anxious" || stress > 0.6) {
            // Shallow, rapid, tense breathing
            targetFreq = 0.38;
            targetAmp = 0.85;
        } else if (primary === "sad") {
            // Slow, deep, heavy sigh-like breathing
            targetFreq = 0.16; // ~10 bpm
            targetAmp = 0.75;
        } else if (primary === "thinking" || primary === "focused") {
            // Steady, quiet breathing
            targetFreq = 0.20;
            targetAmp = 0.90;
        } else {
            // Default natural rhythm
            targetFreq = 0.22 + (energy - 0.5) * 0.1;
            targetAmp = 1.0;
        }

        // Advance harmonic respiratory phase
        const speed = targetFreq * 2 * Math.PI;
        this.phase = (this.phase + speed * deltaSeconds) % (2 * Math.PI);

        // Multi-harmonic respiratory curve (organic non-linear expansion vs deflation)
        // Inhalation is slightly shorter than exhalation in natural human breathing
        const primaryWave = (Math.sin(this.phase) + 1) * 0.5; // 0 to 1
        const thoracicHarmonic = Math.sin(this.phase * 2) * 0.08; // Subtle chest lift harmonic

        this.breathValue = Math.max(0, Math.min(1, (primaryWave + thoracicHarmonic) * targetAmp));

        // Shoulder lift slightly lags breath expansion by ~15 degrees phase offset
        const shoulderPhase = this.phase - 0.25;
        this.shoulderValue = Math.sin(shoulderPhase) * 0.25 * targetAmp;

        // Subtle model scale pulse for breathing depth
        this.scaleOffset = Math.sin(this.phase) * 0.006 * targetAmp;

        return {
            breath: this.breathValue,
            shoulder: this.shoulderValue,
            scaleOffset: this.scaleOffset,
        };
    }
}
