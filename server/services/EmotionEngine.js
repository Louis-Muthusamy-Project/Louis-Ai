/**
 * ==========================================
 * EmotionEngine - Cognitive Emotion Service
 * ==========================================
 * Manages per-session EmotionState:
 *   - Multi-axis text analysis
 *   - Decay over time
 *   - Mood history
 *   - Prediction
 *   - Blending
 *   - Relationship-aware trust/attachment updates
 */
const EmotionState = require("../domain/EmotionState");

// Keyword delta tables
const KEYWORD_DELTAS = {
    happy:   { joy: +0.15, stress: -0.08, mood: +0.20, energy: +0.05 },
    glad:    { joy: +0.10, stress: -0.05, mood: +0.12 },
    awesome: { joy: +0.12, energy: +0.10, mood: +0.15 },
    great:   { joy: +0.10, mood: +0.10 },
    yay:     { joy: +0.15, energy: +0.10, mood: +0.18 },
    love:    { joy: +0.12, attachment: +0.08, trust: +0.05, mood: +0.15 },
    thanks:  { trust: +0.05, joy: +0.08, mood: +0.08 },
    sad:     { joy: -0.20, mood: -0.25, stress: +0.10, energy: -0.10 },
    sorry:   { joy: -0.08, stress: +0.08, mood: -0.10 },
    miss:    { joy: -0.10, attachment: +0.05, mood: -0.12 },
    cry:     { joy: -0.18, mood: -0.22, energy: -0.08 },
    angry:   { stress: +0.30, mood: -0.30, energy: +0.10, confidence: -0.10 },
    hate:    { stress: +0.25, mood: -0.28, trust: -0.08 },
    annoy:   { stress: +0.20, mood: -0.20, focus: -0.10 },
    wow:     { curiosity: +0.15, energy: +0.15, joy: +0.10, mood: +0.12 },
    amazing: { curiosity: +0.12, joy: +0.12, energy: +0.10 },
    excited: { joy: +0.20, energy: +0.20, curiosity: +0.10, mood: +0.18 },
    fantastic:{ joy: +0.15, energy: +0.12, mood: +0.15 },
    boring:  { curiosity: -0.20, energy: -0.10, focus: -0.15, mood: -0.10 },
    tired:   { energy: -0.20, focus: -0.15, stress: +0.10 },
    confused:{ focus: -0.20, curiosity: +0.10, stress: +0.08, confidence: -0.10 },
    lost:    { focus: -0.15, confidence: -0.10, stress: +0.10 },
    scared:  { stress: +0.25, confidence: -0.15, focus: -0.10, mood: -0.15 },
    nervous: { stress: +0.20, confidence: -0.10, energy: +0.05 },
};

// Intent-based delta tables
const INTENT_DELTAS = {
    USE_TOOL: { curiosity: +0.10, focus: +0.15, energy: +0.05 },
    MATH:     { focus: +0.20, curiosity: +0.05, stress: -0.03 },
    TIME:     { focus: +0.05 },
    CHAT:     { joy: +0.05, trust: +0.02, attachment: +0.01 }
};

// Max items in mood history per socket
const MAX_HISTORY = 50;

// Resting baseline for prediction use
const RESTING = new EmotionState();

class EmotionEngine {
    constructor() {
        // Map<socketId, EmotionState>
        this._states = new Map();
        // Map<socketId, Array<{state, timestamp}>>
        this._history = new Map();

        // Global decay timer (every 5 seconds)
        this._decayInterval = setInterval(() => {
            this._tickDecay();
        }, 5000);
    }

    // ── Session lifecycle ───────────────────────────────────────────────────

    _ensure(socketId) {
        if (!this._states.has(socketId)) {
            this._states.set(socketId, new EmotionState());
            this._history.set(socketId, []);
        }
    }

    reset(socketId) {
        this._states.delete(socketId);
        this._history.delete(socketId);
    }

    // ── Core API ────────────────────────────────────────────────────────────

    /**
     * Returns current EmotionState for a session.
     */
    getState(socketId) {
        this._ensure(socketId);
        return this._states.get(socketId);
    }

    /**
     * Returns mood history snapshots for a session.
     */
    getMoodHistory(socketId) {
        this._ensure(socketId);
        return this._history.get(socketId);
    }

    /**
     * Main update path: analyze message text + intent, blend into state.
     * @returns {EmotionState} updated state
     */
    analyzeText(socketId, text = "", intent = "CHAT") {
        this._ensure(socketId);
        const current = this._states.get(socketId);
        const lower = text.toLowerCase();

        // Accumulate keyword deltas
        let deltaAccum = {};
        for (const [keyword, deltas] of Object.entries(KEYWORD_DELTAS)) {
            if (lower.includes(keyword)) {
                for (const [axis, val] of Object.entries(deltas)) {
                    deltaAccum[axis] = (deltaAccum[axis] || 0) + val;
                }
            }
        }

        // Structural cues
        const questionCount = (text.match(/\?/g) || []).length;
        if (questionCount > 0) {
            deltaAccum.curiosity = (deltaAccum.curiosity || 0) + questionCount * 0.05;
            deltaAccum.focus = (deltaAccum.focus || 0) + questionCount * 0.03;
        }
        if (text.length > 150) {
            // Long message signals engagement
            deltaAccum.focus = (deltaAccum.focus || 0) + 0.05;
            deltaAccum.energy = (deltaAccum.energy || 0) + 0.03;
        }
        if (/[!]{2,}/.test(text)) {
            // Multiple exclamation marks → excitement
            deltaAccum.energy = (deltaAccum.energy || 0) + 0.08;
            deltaAccum.joy = (deltaAccum.joy || 0) + 0.05;
        }

        // Intent deltas
        const intentD = INTENT_DELTAS[intent];
        if (intentD) {
            for (const [axis, val] of Object.entries(intentD)) {
                deltaAccum[axis] = (deltaAccum[axis] || 0) + val;
            }
        }

        // Scale down large accumulations (max single-update shift = 0.4/axis)
        for (const key of Object.keys(deltaAccum)) {
            deltaAccum[key] = Math.max(-0.4, Math.min(0.4, deltaAccum[key]));
        }

        const updated = current.applyDeltas(deltaAccum);
        this._states.set(socketId, updated);
        this._recordHistory(socketId, updated);

        return updated;
    }

    /**
     * Apply relationship-level delta (trust + attachment).
     * Called when relationship.level increases.
     */
    applyRelationshipBoost(socketId, levelDelta = 1) {
        this._ensure(socketId);
        const current = this._states.get(socketId);
        const updated = current.applyDeltas({
            trust: levelDelta * 0.05,
            attachment: levelDelta * 0.08,
            joy: levelDelta * 0.03
        });
        this._states.set(socketId, updated);
        this._recordHistory(socketId, updated);
        return updated;
    }

    /**
     * Predict the next likely dominant emotion based on trajectory.
     * Uses last 3 history points to compute trend direction.
     */
    predict(socketId) {
        this._ensure(socketId);
        const history = this._history.get(socketId);
        if (history.length < 2) {
            return this.getState(socketId).toPrimaryEmotion();
        }

        // Trend: last point - third-to-last point
        const last = history[history.length - 1].state;
        const base = history[Math.max(0, history.length - 3)].state;

        const trend = new EmotionState({
            joy:        last.joy        + (last.joy - base.joy),
            stress:     last.stress     + (last.stress - base.stress),
            curiosity:  last.curiosity  + (last.curiosity - base.curiosity),
            energy:     last.energy     + (last.energy - base.energy),
            focus:      last.focus      + (last.focus - base.focus),
            mood:       last.mood       + (last.mood - base.mood),
            trust:      last.trust,
            attachment: last.attachment,
            confidence: last.confidence
        });

        return trend.toPrimaryEmotion();
    }

    // ── Internal ────────────────────────────────────────────────────────────

    _tickDecay() {
        for (const [socketId, state] of this._states.entries()) {
            const decayed = state.decay(5);
            this._states.set(socketId, decayed);
        }
    }

    _recordHistory(socketId, state) {
        const history = this._history.get(socketId);
        history.push({ state, timestamp: new Date().toISOString() });
        if (history.length > MAX_HISTORY) {
            history.shift();
        }
    }

    /**
     * Cleanup on server shutdown.
     */
    destroy() {
        clearInterval(this._decayInterval);
    }
}

module.exports = new EmotionEngine();
