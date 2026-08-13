/**
 * ============================================================================
 * EyeTrackingController
 * ============================================================================
 * Handles realistic eye tracking, gaze targets, micro-saccadic eye jitter,
 * natural conversational glance-away breaks, and emotion gaze directions.
 *
 * Parameters controlled:
 * - ParamEyeBallX (-1.0 to 1.0)
 * - ParamEyeBallY (-1.0 to 1.0)
 */

export class EyeTrackingController {
    constructor() {
        // Current filtered eyeball position
        this.x = 0;
        this.y = 0;

        // Base target from mouse or focal point
        this.targetX = 0;
        this.targetY = 0;

        // Micro-saccades (natural involuntary tiny eye jumps)
        this.saccadeOffsetX = 0;
        this.saccadeOffsetY = 0;
        this.saccadeTimer = 0;
        this.nextSaccadeDelay = 1200; // ms

        // Conversational glance-away state
        this.glanceTimer = 0;
        this.nextGlanceDelay = 5000; // ms
        this.isGlancingAway = false;
        this.glanceOffsetX = 0;
        this.glanceOffsetY = 0;
        this.glanceDuration = 1200;
        this.glanceElapsed = 0;

        // Smoothing velocity for spring-damper
        this.vx = 0;
        this.vy = 0;
        this.smoothTime = 0.08; // Fast, responsive eye saccade
    }

    /**
     * Set external look-at target (e.g. mouse or character position).
     * @param {number} x - Normalized X coordinate in range [-1, 1]
     * @param {number} y - Normalized Y coordinate in range [-1, 1]
     */
    setTarget(x, y) {
        this.targetX = Math.max(-1, Math.min(1, x));
        this.targetY = Math.max(-1, Math.min(1, y));
    }

    /**
     * Update eye tracking state per frame.
     * @param {number} deltaSeconds - Delta time in seconds
     * @param {object} emotionState - 9-axis emotion state
     * @param {boolean} isSpeaking - Whether character is actively speaking
     */
    update(deltaSeconds, emotionState = {}, _isSpeaking = false) {
        const deltaMs = deltaSeconds * 1000;
        const { primary, curiosity = 0.5 } = emotionState;

        // 1. Compute emotion-specific gaze bias
        let emotionBiasX = 0;
        let emotionBiasY = 0;

        if (primary === "thinking") {
            // Looking up and slightly to the side when pondering
            emotionBiasX = 0.35;
            emotionBiasY = 0.45;
        } else if (primary === "sad" || primary === "shy") {
            // Looking down submissively or bashfully
            emotionBiasX = 0;
            emotionBiasY = -0.35;
        } else if (primary === "curious" || curiosity > 0.7) {
            // Strong focal alignment with target
            emotionBiasX = 0;
            emotionBiasY = 0.05;
        } else if (primary === "anxious") {
            // Restless wandering gaze
            emotionBiasX = Math.sin(Date.now() * 0.003) * 0.25;
            emotionBiasY = Math.cos(Date.now() * 0.004) * 0.15;
        }

        // 2. Micro-saccades generator (small, subtle eye twitch to simulate biological focus)
        this.saccadeTimer += deltaMs;
        if (this.saccadeTimer >= this.nextSaccadeDelay) {
            this.saccadeTimer = 0;
            this.nextSaccadeDelay = 800 + Math.random() * 1600;
            // Tiny micro-jump ±0.04
            this.saccadeOffsetX = (Math.random() - 0.5) * 0.08;
            this.saccadeOffsetY = (Math.random() - 0.5) * 0.06;
        }

        // 3. Conversational glance-away simulation (natural eye contact breaks during speech/conversation)
        if (!this.isGlancingAway) {
            this.glanceTimer += deltaMs;
            if (this.glanceTimer >= this.nextGlanceDelay) {
                this.glanceTimer = 0;
                this.nextGlanceDelay = 4500 + Math.random() * 4500;
                this.isGlancingAway = true;
                this.glanceElapsed = 0;
                this.glanceDuration = 1000 + Math.random() * 800;
                // Pick a natural glance-away direction (down-left, down-right, or side)
                const sign = Math.random() > 0.5 ? 1 : -1;
                this.glanceOffsetX = sign * (0.3 + Math.random() * 0.3);
                this.glanceOffsetY = -0.2 + (Math.random() - 0.5) * 0.2;
            }
        } else {
            this.glanceElapsed += deltaMs;
            if (this.glanceElapsed >= this.glanceDuration) {
                this.isGlancingAway = false;
                this.glanceOffsetX = 0;
                this.glanceOffsetY = 0;
            }
        }

        // Glance-away blend weight (smooth in, hold, smooth out)
        let glanceWeight = 0;
        if (this.isGlancingAway) {
            const t = this.glanceElapsed / this.glanceDuration;
            if (t < 0.25) {
                glanceWeight = t / 0.25;
            } else if (t < 0.75) {
                glanceWeight = 1.0;
            } else {
                glanceWeight = (1.0 - t) / 0.25;
            }
        }

        // Suppress glance away during intense curiosity
        if (primary === "curious" || curiosity > 0.75) {
            glanceWeight *= 0.2;
        }

        // 4. Combine all layers into final target position
        const combinedTargetX = this.targetX + emotionBiasX + this.saccadeOffsetX + (this.glanceOffsetX * glanceWeight);
        const combinedTargetY = this.targetY + emotionBiasY + this.saccadeOffsetY + (this.glanceOffsetY * glanceWeight);

        // Clamp to physical eyeball range
        const clampedX = Math.max(-1.0, Math.min(1.0, combinedTargetX));
        const clampedY = Math.max(-1.0, Math.min(1.0, combinedTargetY));

        // 5. High-speed smooth dampening (spring-damper)
        const lambda = 18.0; // Responsive eye saccade tracking rate
        const factor = 1.0 - Math.exp(-lambda * deltaSeconds);
        this.x += (clampedX - this.x) * factor;
        this.y += (clampedY - this.y) * factor;

        return {
            eyeBallX: this.x,
            eyeBallY: this.y,
        };
    }
}
