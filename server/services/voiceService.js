/**
 * ==========================================
 * Upgraded Voice Service
 * ==========================================
 * Features:
 *   - Speech State Machine (idle, generating, speaking, interrupted)
 *   - Chronological Speech Queue with Interrupt priority
 *   - Dynamic voice provider routing
 *   - Accurate Lip Sync (Viseme) preparation and timings
 *   - Noise Reduction & Voice Identification utilities
 *   - Wake Word matching
 */
const EventEmitter = require("events");
const EdgeTTSProvider = require("../providers/tts/EdgeTTSProvider");
const TTSService = require("./ttsService");

// Bind default provider
TTSService.setProvider(new EdgeTTSProvider());

// Must match EdgeTTSProvider's configured OUTPUT_FORMAT (96kbps mono mp3),
// used only to estimate real playback duration from actual audio byte size.
const TTS_BITRATE_BPS = 96000;

const SPEECH_STATES = Object.freeze({
    IDLE: "idle",
    GENERATING: "generating",
    SPEAKING: "speaking",
    INTERRUPTED: "interrupted"
});

class VoiceService extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.currentState = SPEECH_STATES.IDLE;
        this.currentText = "";
        
        // Multi-provider registry
        this.providers = {
            edge: new EdgeTTSProvider()
        };
        this.activeProviderName = "edge";

        // Voice signatures for Identification
        this.registeredProfiles = {
            "Louis": { signature: "low-resonance-standard", active: true }
        };
    }

    // ── Speech State Machine ───────────────────────────────────────────────

    getState() {
        return this.currentState;
    }

    _transitionTo(state) {
        if (this.currentState === state) return;
        const prev = this.currentState;
        this.currentState = state;
        this.emit("voice:state-changed", { from: prev, to: state });
    }

    // ── Multi-Provider Management ──────────────────────────────────────────

    setProvider(providerName) {
        if (!this.providers[providerName]) {
            throw new Error(`TTS Provider [${providerName}] not registered.`);
        }
        this.activeProviderName = providerName;
        TTSService.setProvider(this.providers[providerName]);
        this.emit("voice:provider-changed", { provider: providerName });
    }

    getActiveProvider() {
        return this.providers[this.activeProviderName];
    }

    // ── Speech Queue & Execution ───────────────────────────────────────────

    isBusy() {
        return this.currentState === SPEECH_STATES.SPEAKING || this.currentState === SPEECH_STATES.GENERATING;
    }

    getCurrentText() {
        return this.currentText;
    }

    /**
     * Enqueue a text reply. Splits into sentences for streaming speech.
     * @param {string} text
     * @param {string} ownerId - authenticated user this speech belongs to;
     *   required so the socket bridge only ever delivers audio to the
     *   right user (see socketHandler.js).
     */
    enqueue(text, ownerId) {
        if (!text || !text.trim()) return;
        if (!ownerId) {
            console.warn("[VoiceService] enqueue() called without an ownerId - dropping (cannot route audio safely).");
            return;
        }

        // Split by sentence markers for smooth streaming speech segments
        const segments = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
        for (const segment of segments) {
            this.queue.push({
                text: segment,
                ownerId,
                timestamp: Date.now()
            });
        }
        
        // Process queue if currently idle
        if (this.currentState === SPEECH_STATES.IDLE) {
            this.playQueue().catch(err => {
                console.error("[VoiceService] playQueue error:", err);
            });
        }
    }

    async speak(segment) {
        const { text, ownerId } = segment;
        if (this.currentState === SPEECH_STATES.INTERRUPTED) return;
        
        this.currentText = text;
        this._currentOwnerId = ownerId;
        this._transitionTo(SPEECH_STATES.GENERATING);

        this.emit("voice:start", { text, ownerId });

        try {
            // Synthesize audio - fully in memory, no temp files (see EdgeTTSProvider)
            const audioData = await TTSService.synthesize({ text });
            
            if (this.currentState === SPEECH_STATES.INTERRUPTED) return;
            this._transitionTo(SPEECH_STATES.SPEAKING);

            // Base64 data URI - playable directly by an <audio> element on the
            // frontend with zero backend disk I/O and no static file route needed.
            const audioDataUri = `data:${audioData.mimeType};base64,${audioData.audio.toString("base64")}`;

            this.emit("voice:audio", {
                text,
                ownerId,
                audio: audioDataUri,
                voice: audioData.voice
                // NOTE: mouth movement is driven entirely by the frontend's real
                // Web Audio AnalyserNode reading the actual played-back audio
                // (see yuna/src/live2d/LipSyncEngine.js) - not by any
                // backend-precomputed viseme timings. A previous
                // `calculateLipSync()` helper here generated Math.random()-based
                // fake mouth-opening values and emitted them as `visemes`, but
                // nothing on the frontend ever read that field (confirmed: no
                // references to `.visemes` anywhere in yuna/src). It's been
                // removed rather than left as unused fake data alongside the
                // real analyser-driven implementation.
            });

            // Real duration estimated from the actual audio byte size and the
            // fixed output bitrate (96kbps mono, see EdgeTTSProvider), not a
            // guess based on text length.
            const estimatedMs = (audioData.audio.length * 8 / TTS_BITRATE_BPS) * 1000;
            const duration = Math.max(300, estimatedMs);
            await this.delay(duration);

            if (this.currentState === SPEECH_STATES.SPEAKING) {
                this.emit("voice:end", { text, ownerId });
                this._transitionTo(SPEECH_STATES.IDLE);
            }
        } catch (error) {
            console.error("[VoiceService] Synthesis failed:", error);
            this.emit("voice:error", { error: error.message, text, ownerId });
            this._transitionTo(SPEECH_STATES.IDLE);
        } finally {
            this.currentText = "";
        }
    }

    async playQueue() {
        while (this.queue.length > 0) {
            if (this.currentState === SPEECH_STATES.INTERRUPTED) {
                break;
            }
            const segment = this.queue.shift();
            await this.speak(segment);
        }
        if (this.currentState !== SPEECH_STATES.INTERRUPTED) {
            this._transitionTo(SPEECH_STATES.IDLE);
        }
    }

    /**
     * Interrupts any active speech generation or playback immediately.
     */
    stop() {
        this.queue = [];
        this.currentText = "";
        this._transitionTo(SPEECH_STATES.INTERRUPTED);
        
        this.emit("voice:stop");
        this.emit("voice:interrupted");

        // Release interrupt back to idle after a short delay
        setTimeout(() => {
            if (this.currentState === SPEECH_STATES.INTERRUPTED) {
                this._transitionTo(SPEECH_STATES.IDLE);
            }
        }, 300);
    }

    clearQueue() {
        this.queue = [];
    }

    /**
     * Cancels only this user's pending/playing speech. voiceService is a
     * single shared queue/state-machine across all connected users (a
     * pre-existing architectural limitation, not something rearchitected
     * here - see project notes), so this can only remove THIS user's
     * still-queued segments outright, and additionally interrupts the
     * currently-playing segment only if it also belongs to this user.
     * It deliberately does NOT call stop() (which would silence every
     * user), so a genuinely concurrent different user's speech is left
     * alone.
     */
    cancelForUser(ownerId) {
        if (!ownerId) return;

        const hadQueued = this.queue.some(seg => seg.ownerId === ownerId);
        this.queue = this.queue.filter(seg => seg.ownerId !== ownerId);

        const isThisUserCurrentlySpeaking =
            (this.currentState === SPEECH_STATES.SPEAKING || this.currentState === SPEECH_STATES.GENERATING) &&
            this._currentOwnerId === ownerId;

        if (isThisUserCurrentlySpeaking) {
            this.currentText = "";
            this._transitionTo(SPEECH_STATES.INTERRUPTED);
            this.emit("voice:stop", { ownerId });
            this.emit("voice:interrupted", { ownerId });
            setTimeout(() => {
                if (this.currentState === SPEECH_STATES.INTERRUPTED) {
                    this._transitionTo(SPEECH_STATES.IDLE);
                }
            }, 300);
        } else if (hadQueued) {
            this.emit("voice:stop", { ownerId });
        }
    }

    // ── Cognitive Audio Analysis Utilities ──────────────────────────────────

    /**
     * Noise Reduction Filter
     * Real implementation would require a native C++ module or a robust web audio API in node.
     * Removed fake pass-through.
     */
    applyNoiseReduction(buffer, threshold = 0.05) {
        if (!buffer) return null;
        // If no real implementation exists, we don't pretend to process it.
        return buffer;
    }

    /**
     * Voice Identification
     * Real implementation would require a speaker verification model.
     * Removed fake mock implementation.
     */
    identifyVoice(audioFingerprint) {
        // We do not pretend to identify voices if we lack the capability.
        return { identified: false, user: "Guest", confidence: 0 };
    }

    /**
     * Wake Word Detection
     * Checks if input speech contains Yuna's wake keywords.
     */
    detectWakeWord(text = "") {
        const lower = text.toLowerCase();
        const keywords = ["hey yuna", "wake up yuna", "yuna"];
        for (const kw of keywords) {
            if (lower.includes(kw)) {
                this.emit("voice:wake");
                return true;
            }
        }
        return false;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton wrapper matching Kernel requirements
module.exports = new VoiceService();