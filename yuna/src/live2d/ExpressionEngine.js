/**
 * ============================================================================
 * ExpressionEngine
 * ============================================================================
 * Manages smooth multi-channel cross-fading between facial expressions,
 * supporting 10 emotion presets and continuous fine-tuning from Yuna's
 * 9-axis cognitive Emotion Engine.
 *
 * Parameters controlled:
 * - ParamEyeLSmile, ParamEyeRSmile (0 to 1)
 * - ParamBrowLY, ParamBrowRY (-1 to 1)
 * - ParamBrowLX, ParamBrowRX (-1 to 1)
 * - ParamBrowLAngle, ParamBrowRAngle (-1 to 1)
 * - ParamBrowLForm, ParamBrowRForm (-1 to 1)
 * - ParamMouthForm (-1 to 1)
 * - ParamCheek (0 to 1)
 */

export const EXPRESSION_PRESETS = {
    neutral: {
        eyeLSmile: 0.0,
        eyeRSmile: 0.0,
        browLY: 0.0,
        browRY: 0.0,
        browLX: 0.0,
        browRX: 0.0,
        browLAngle: 0.0,
        browRAngle: 0.0,
        browLForm: 0.0,
        browRForm: 0.0,
        mouthForm: 0.0,
        cheek: 0.0,
    },
    happy: {
        eyeLSmile: 0.85,
        eyeRSmile: 0.85,
        browLY: 0.45,
        browRY: 0.45,
        browLX: 0.0,
        browRX: 0.0,
        browLAngle: 0.2,
        browRAngle: 0.2,
        browLForm: 0.5,
        browRForm: 0.5,
        mouthForm: 0.85,
        cheek: 0.40,
    },
    excited: {
        eyeLSmile: 1.0,
        eyeRSmile: 1.0,
        browLY: 0.75,
        browRY: 0.75,
        browLX: 0.0,
        browRX: 0.0,
        browLAngle: 0.35,
        browRAngle: 0.35,
        browLForm: 0.8,
        browRForm: 0.8,
        mouthForm: 1.0,
        cheek: 0.65,
    },
    sad: {
        eyeLSmile: 0.0,
        eyeRSmile: 0.0,
        browLY: -0.40,
        browRY: -0.40,
        browLX: -0.20,
        browRX: -0.20,
        browLAngle: -0.55,
        browRAngle: -0.55,
        browLForm: -0.50,
        browRForm: -0.50,
        mouthForm: -0.65,
        cheek: 0.0,
    },
    angry: {
        eyeLSmile: 0.0,
        eyeRSmile: 0.0,
        browLY: -0.50,
        browRY: -0.50,
        browLX: 0.40,
        browRX: 0.40,
        browLAngle: 0.70,
        browRAngle: 0.70,
        browLForm: -0.60,
        browRForm: -0.60,
        mouthForm: -0.45,
        cheek: 0.15,
    },
    anxious: {
        eyeLSmile: 0.10,
        eyeRSmile: 0.0,
        browLY: -0.20,
        browRY: 0.20,
        browLX: -0.30,
        browRX: -0.30,
        browLAngle: -0.40,
        browRAngle: -0.20,
        browLForm: -0.30,
        browRForm: 0.20,
        mouthForm: -0.25,
        cheek: 0.20,
    },
    curious: {
        eyeLSmile: 0.20,
        eyeRSmile: 0.35,
        browLY: 0.60,  // Asymmetric quizzical arch
        browRY: 0.10,
        browLX: 0.10,
        browRX: 0.0,
        browLAngle: 0.25,
        browRAngle: -0.10,
        browLForm: 0.40,
        browRForm: 0.0,
        mouthForm: 0.30,
        cheek: 0.25,
    },
    thinking: {
        eyeLSmile: 0.10,
        eyeRSmile: 0.10,
        browLY: 0.25,
        browRY: -0.15,
        browLX: 0.0,
        browRX: 0.0,
        browLAngle: 0.15,
        browRAngle: -0.25,
        browLForm: 0.20,
        browRForm: -0.20,
        mouthForm: 0.10,
        cheek: 0.10,
    },
    shy: {
        eyeLSmile: 0.50,
        eyeRSmile: 0.50,
        browLY: 0.10,
        browRY: 0.10,
        browLX: -0.10,
        browRX: -0.10,
        browLAngle: -0.15,
        browRAngle: -0.15,
        browLForm: 0.10,
        browRForm: 0.10,
        mouthForm: 0.40,
        cheek: 0.85, // Vibrant blush!
    },
    surprised: {
        eyeLSmile: 0.0,
        eyeRSmile: 0.0,
        browLY: 0.80,
        browRY: 0.80,
        browLX: 0.0,
        browRX: 0.0,
        browLAngle: 0.10,
        browRAngle: 0.10,
        browLForm: 0.60,
        browRForm: 0.60,
        mouthForm: 0.10,
        cheek: 0.20,
    },
};

export class ExpressionEngine {
    constructor() {
        // Current blended values
        this.current = { ...EXPRESSION_PRESETS.neutral };
        // Target values
        this.target = { ...EXPRESSION_PRESETS.neutral };
        // Initial values when transition began
        this.from = { ...EXPRESSION_PRESETS.neutral };

        this.currentEmotion = "neutral";
        this.transitionDuration = 450; // ms
        this.transitionElapsed = 450;
        this.isTransitioning = false;
    }

    /**
     * Trigger a smooth expression change to a named preset.
     * @param {string} emotionName - Preset name (e.g. 'happy', 'curious', 'sad')
     * @param {number} duration - Transition duration in ms (default 450ms)
     */
    setEmotion(emotionName, duration = 450) {
        const key = EXPRESSION_PRESETS[emotionName] ? emotionName : "neutral";
        if (this.currentEmotion === key && !this.isTransitioning) return;

        this.currentEmotion = key;
        this.from = { ...this.current };
        this.target = { ...EXPRESSION_PRESETS[key] };
        this.transitionDuration = duration;
        this.transitionElapsed = 0;
        this.isTransitioning = true;
    }

    /**
     * Update parameter blending per frame.
     * @param {number} deltaMs - Delta time in milliseconds
     * @param {object} emotionState - 9-axis emotion state for continuous modulation
     */
    update(deltaMs, emotionState = {}) {
        const { joy = 0.5, attachment = 0.3, stress = 0.1, energy = 0.5 } = emotionState;

        // Progress transition if active
        if (this.isTransitioning) {
            this.transitionElapsed += deltaMs;
            const progress = Math.min(1.0, this.transitionElapsed / this.transitionDuration);

            // Smooth cubic ease-in-out
            const ease = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            for (const key of Object.keys(this.target)) {
                this.current[key] = this.from[key] + (this.target[key] - this.from[key]) * ease;
            }

            if (progress >= 1.0) {
                this.isTransitioning = false;
                this.current = { ...this.target };
            }
        }

        // Apply continuous cognitive axis fine-tuning:
        // 1. Cheek blush increases with attachment and joy
        const dynamicCheek = Math.max(
            this.current.cheek,
            Math.min(1.0, (attachment * 0.4) + (joy > 0.6 ? (joy - 0.6) * 0.8 : 0.0))
        );

        // 2. Eyebrow arch subtly heightens with energy
        const energyBrowBoost = (energy - 0.5) * 0.15;
        const dynamicBrowLY = Math.max(-1.0, Math.min(1.0, this.current.browLY + energyBrowBoost));
        const dynamicBrowRY = Math.max(-1.0, Math.min(1.0, this.current.browRY + energyBrowBoost));

        // 3. Stress subtly furrows the brow angle
        const stressFurrow = stress > 0.5 ? (stress - 0.5) * 0.3 : 0;
        const dynamicBrowLAngle = Math.max(-1.0, Math.min(1.0, this.current.browLAngle + stressFurrow));
        const dynamicBrowRAngle = Math.max(-1.0, Math.min(1.0, this.current.browRAngle + stressFurrow));

        return {
            ...this.current,
            cheek: dynamicCheek,
            browLY: dynamicBrowLY,
            browRY: dynamicBrowRY,
            browLAngle: dynamicBrowLAngle,
            browRAngle: dynamicBrowRAngle,
        };
    }
}
