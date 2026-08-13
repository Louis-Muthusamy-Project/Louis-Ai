/**
 * ============================================================================
 * BlinkController
 * ============================================================================
 * Handles organic, asymmetric eye blinking, randomized intervals, occasional
 * double-blinking, and emotion-aware resting eye openness / squint modulation.
 *
 * Parameters controlled:
 * - ParamEyeLOpen (0 = closed, 1 = fully open)
 * - ParamEyeROpen (0 = closed, 1 = fully open)
 */

export class BlinkController {
    constructor() {
        // State
        this.eyeOpen = 1.0;
        this.isBlinking = false;
        this.isDoubleBlinking = false;

        // Timing configurations (in milliseconds)
        this.minInterval = 2500;
        this.maxInterval = 6000;
        this.nextBlinkDelay = this._getRandomInterval();
        this.timer = 0;

        // Blink phase state
        this.blinkProgress = 0; // 0 -> 1 during blink
        this.closeDuration = 80;  // Fast closing (ms)
        this.holdDuration = 20;   // Brief closed hold (ms)
        this.openDuration = 140;  // Smooth reopening (ms)
        this.totalDuration = this.closeDuration + this.holdDuration + this.openDuration;
        this.elapsed = 0;

        // Custom resting openness (modified by emotions or sleepy/focused states)
        this.restingOpen = 1.0;
        this.forcedOpenness = null; // Override if needed
    }

    _getRandomInterval() {
        return this.minInterval + Math.random() * (this.maxInterval - this.minInterval);
    }

    /**
     * Trigger a natural blink immediately.
     */
    triggerBlink(isDouble = false) {
        if (this.isBlinking) return;
        this.isBlinking = true;
        this.isDoubleBlinking = isDouble;
        this.elapsed = 0;
        this.blinkProgress = 0;
    }

    /**
     * Update blink state per frame.
     * @param {number} deltaMs - Milliseconds elapsed since last frame
     * @param {object} emotionState - 9-axis emotion state { primary, joy, energy, stress, etc. }
     */
    update(deltaMs, emotionState = {}) {
        // Adapt resting openness based on primary emotion
        this._adaptToEmotion(emotionState);

        if (!this.isBlinking) {
            this.timer += deltaMs;
            if (this.timer >= this.nextBlinkDelay) {
                this.timer = 0;
                this.nextBlinkDelay = this._getRandomInterval();
                // 15% chance of an expressive double-blink
                const isDouble = Math.random() < 0.15;
                this.triggerBlink(isDouble);
            }
            this.eyeOpen = this.restingOpen;
            return {
                eyeLOpen: this.eyeOpen,
                eyeROpen: this.eyeOpen,
            };
        }

        // Active blink execution
        this.elapsed += deltaMs;

        if (this.elapsed < this.closeDuration) {
            // Closing phase: cubic ease-in (starts gentle, snaps shut)
            const t = this.elapsed / this.closeDuration;
            const easeIn = t * t * t;
            this.eyeOpen = this.restingOpen * (1 - easeIn);
        } else if (this.elapsed < this.closeDuration + this.holdDuration) {
            // Closed hold phase
            this.eyeOpen = 0.0;
        } else if (this.elapsed < this.totalDuration) {
            // Reopening phase: cubic ease-out (smooth, soft finish)
            const openElapsed = this.elapsed - (this.closeDuration + this.holdDuration);
            const t = openElapsed / this.openDuration;
            const easeOut = 1 - Math.pow(1 - t, 3);
            this.eyeOpen = this.restingOpen * easeOut;
        } else {
            // Blink cycle complete
            this.eyeOpen = this.restingOpen;
            this.isBlinking = false;

            if (this.isDoubleBlinking) {
                this.isDoubleBlinking = false;
                // Schedule second micro-blink after 80ms
                this.timer = this.nextBlinkDelay - 80;
            }
        }

        // Apply any manual forced openness if active
        if (this.forcedOpenness !== null) {
            this.eyeOpen = this.forcedOpenness;
        }

        return {
            eyeLOpen: Math.max(0, Math.min(1, this.eyeOpen)),
            eyeROpen: Math.max(0, Math.min(1, this.eyeOpen)),
        };
    }

    _adaptToEmotion(emotionState) {
        const { primary, joy = 0.5 } = emotionState;

        if (primary === "happy" || joy > 0.7) {
            // Slightly softer resting eyes during happiness (natural eye smile)
            this.restingOpen = 0.92;
            this.minInterval = 2800;
            this.maxInterval = 5500;
        } else if (primary === "excited") {
            // Energetic, frequent blinks
            this.restingOpen = 1.0;
            this.minInterval = 1800;
            this.maxInterval = 3800;
        } else if (primary === "sad" || primary === "anxious") {
            // Slower, heavier blinks
            this.restingOpen = 0.85;
            this.minInterval = 3200;
            this.maxInterval = 7000;
        } else if (primary === "curious" || primary === "surprised") {
            // Wide attentive eyes with fewer blinks
            this.restingOpen = 1.0;
            this.minInterval = 4000;
            this.maxInterval = 8000;
        } else if (primary === "thinking") {
            this.restingOpen = 0.90;
            this.minInterval = 3000;
            this.maxInterval = 6000;
        } else {
            this.restingOpen = 1.0;
            this.minInterval = 2500;
            this.maxInterval = 6000;
        }
    }

    setForcedOpenness(value) {
        this.forcedOpenness = value;
    }
}
