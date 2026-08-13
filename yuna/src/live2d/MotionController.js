/**
 * ============================================================================
 * MotionController
 * ============================================================================
 * Manages priority-based animation queues, cross-fading, and motion execution
 * for Live2D Cubism models.
 *
 * Priority Hierarchy:
 * - FORCE   (3): Direct user interactions (taps), urgent emotional bursts
 * - EMOTION (2): Emotion-driven full body gestures
 * - TALKING (1): Speech-accompanying expressive gestures
 * - IDLE    (0): Ambient life loop background motions
 */

export const MOTION_PRIORITY = {
    IDLE: 0,
    TALKING: 1,
    EMOTION: 2,
    FORCE: 3,
};

// Mappings for Hiyori model motion groups and indices
export const HIYORI_MOTIONS = {
    // Idle motions: 0=m01, 1=m02, 2=m03, 3=m05, 4=m06, 5=m07, 6=m08, 7=m09, 8=m10
    IDLE_HAPPY_1: { group: "Idle", index: 0 },   // m01: Cheerful greeting
    IDLE_HAPPY_2: { group: "Idle", index: 1 },   // m02: Energetic bounce
    IDLE_CALM:    { group: "Idle", index: 2 },   // m03: Gentle idle
    IDLE_EXCITED: { group: "Idle", index: 3 },   // m05: Lively excited
    IDLE_THINKING:{ group: "Idle", index: 4 },   // m06: Contemplative look
    IDLE_CURIOUS: { group: "Idle", index: 5 },   // m07: Leaning forward curious
    IDLE_SAD:     { group: "Idle", index: 6 },   // m08: Drooping calm
    IDLE_RELAX:   { group: "Idle", index: 7 },   // m09: Soft stretch
    IDLE_LOOK:    { group: "Idle", index: 8 },   // m10: Look around
    // Tap body interaction
    TAP_BODY:     { group: "TapBody", index: 0 }, // m04: Reactive tap response
};

export class MotionController {
    constructor(model = null) {
        this.model = model;
        this.currentPriority = MOTION_PRIORITY.IDLE;
        this.currentMotion = null;
        this.isPlaying = false;
        this.queue = [];
        this.listeners = new Set();
    }

    setModel(model) {
        this.model = model;
    }

    /**
     * Play a motion with designated priority.
     * @param {string} group - Motion group name (e.g. 'Idle', 'TapBody')
     * @param {number} index - Motion clip index
     * @param {number} priority - Priority level from MOTION_PRIORITY
     * @param {object} options - Optional callbacks & fadeIn/fadeOut overrides
     * @returns {Promise<boolean>} Resolves true if motion was played
     */
    async playMotion(group, index = 0, priority = MOTION_PRIORITY.IDLE, _options = {}) {
        if (!this.model) return false;

        // Check priority preemption:
        // A lower priority motion cannot interrupt an active higher priority motion
        if (this.isPlaying && priority < this.currentPriority) {
            return false;
        }

        this.currentPriority = priority;
        this.currentMotion = { group, index, priority };
        this.isPlaying = true;

        this._emit("motion_start", { group, index, priority });

        try {
            // Trigger Cubism motion on Live2D model instance
            const result = await this.model.motion(group, index, priority);

            this.isPlaying = false;
            this.currentPriority = MOTION_PRIORITY.IDLE;
            this.currentMotion = null;

            this._emit("motion_complete", { group, index, priority });

            // Process next item in queue if available
            this._processQueue();

            return result;
        } catch (err) {
            console.warn("[MotionController] Motion playback warning:", err);
            this.isPlaying = false;
            this.currentPriority = MOTION_PRIORITY.IDLE;
            this.currentMotion = null;
            this._processQueue();
            return false;
        }
    }

    /**
     * Enqueue a motion to play after current higher-priority motion finishes.
     */
    enqueue(group, index = 0, priority = MOTION_PRIORITY.IDLE, options = {}) {
        this.queue.push({ group, index, priority, options });
        if (!this.isPlaying) {
            this._processQueue();
        }
    }

    /**
     * Clear all pending queued motions.
     */
    clearQueue() {
        this.queue = [];
    }

    _processQueue() {
        if (this.queue.length === 0 || this.isPlaying) return;
        const next = this.queue.shift();
        this.playMotion(next.group, next.index, next.priority, next.options);
    }

    /**
     * Convenience method to trigger tap body interaction motion.
     */
    tapBody() {
        return this.playMotion(HIYORI_MOTIONS.TAP_BODY.group, HIYORI_MOTIONS.TAP_BODY.index, MOTION_PRIORITY.FORCE);
    }

    /**
     * Trigger emotion-based gesture motion.
     */
    playEmotionMotion(emotion) {
        let motion = HIYORI_MOTIONS.IDLE_CALM;
        switch (emotion) {
            case "happy":
                motion = HIYORI_MOTIONS.IDLE_HAPPY_1;
                break;
            case "excited":
                motion = HIYORI_MOTIONS.IDLE_EXCITED;
                break;
            case "curious":
                motion = HIYORI_MOTIONS.IDLE_CURIOUS;
                break;
            case "thinking":
                motion = HIYORI_MOTIONS.IDLE_THINKING;
                break;
            case "sad":
                motion = HIYORI_MOTIONS.IDLE_SAD;
                break;
            default:
                motion = HIYORI_MOTIONS.IDLE_CALM;
                break;
        }
        return this.playMotion(motion.group, motion.index, MOTION_PRIORITY.EMOTION);
    }

    on(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    _emit(event, data) {
        this.listeners.forEach((cb) => cb(event, data));
    }
}
