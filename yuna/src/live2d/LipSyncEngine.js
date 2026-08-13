/**
 * ============================================================================
 * LipSyncEngine
 * ============================================================================
 * Dual-mode real-time lip synchronization engine for Live2D.
 * - Mode A: Web Audio API FFT & RMS volume analysis directly from TTS audio playback.
 * - Mode B: Procedural organic syllable generator for streaming text / synthetic speech.
 *
 * Parameters controlled:
 * - ParamMouthOpenY (0 to 1)
 * - ParamMouthForm (-1 to 1)
 */

export class LipSyncEngine {
    constructor() {
        this.mouthOpenY = 0.0;
        this.mouthForm = 0.0;
        this.isSpeaking = false;

        // Web Audio Analyser reference
        this.analyser = null;
        this.dataArray = null;
        this.freqArray = null;

        // Kinematic smoothing filters
        this.currentVolume = 0.0;
        this.targetVolume = 0.0;
        this.attackSpeed = 28.0;  // Fast opening response
        this.decaySpeed = 12.0;   // Smooth natural closure

        // Procedural syllable generator state
        this.proceduralPhase = 0;
        this.syllableTimer = 0;
        this.syllableDuration = 160; // ms per syllable
        this.targetAperture = 0.0;
    }

    /**
     * Attach a Web Audio AnalyserNode from AudioQueue / audio playback.
     * @param {AnalyserNode} analyserNode
     */
    setAnalyser(analyserNode) {
        this.analyser = analyserNode;
        if (this.analyser) {
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.4;
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            this.freqArray = new Uint8Array(bufferLength);
        } else {
            this.dataArray = null;
            this.freqArray = null;
        }
    }

    /**
     * Start speaking mode.
     */
    start() {
        this.isSpeaking = true;
    }

    /**
     * Stop speaking mode and smoothly return mouth to neutral.
     */
    stop() {
        this.isSpeaking = false;
        this.targetVolume = 0;
        this.targetAperture = 0;
    }

    /**
     * Update lip sync state per frame.
     * @param {number} deltaSeconds - Delta time in seconds
     * @param {boolean} voiceSpeaking - External speaking flag from chatStore
     */
    update(deltaSeconds, voiceSpeaking = false) {
        const deltaMs = deltaSeconds * 1000;
        const speaking = this.isSpeaking || voiceSpeaking;

        if (!speaking) {
            // Smoothly decay mouth to closed resting state
            const factor = 1.0 - Math.exp(-this.decaySpeed * deltaSeconds);
            this.mouthOpenY += (0.0 - this.mouthOpenY) * factor;
            this.mouthForm += (0.0 - this.mouthForm) * factor;

            return {
                mouthOpenY: Math.max(0, Math.min(1, this.mouthOpenY)),
                mouthForm: Math.max(-1, Math.min(1, this.mouthForm)),
            };
        }

        // ── Check if Real Web Audio Analyser is active ───────────────────────
        if (this.analyser && this.dataArray && this.freqArray) {
            // Get time-domain data for volume (RMS amplitude)
            this.analyser.getByteTimeDomainData(this.dataArray);
            let sumSquares = 0;
            for (let i = 0; i < this.dataArray.length; i++) {
                const normalized = (this.dataArray[i] - 128) / 128;
                sumSquares += normalized * normalized;
            }
            const rms = Math.sqrt(sumSquares / this.dataArray.length);

            // Amplify and non-linearly curve RMS volume
            this.targetVolume = Math.min(1.0, Math.pow(rms * 4.5, 1.2));

            // Frequency analysis for vowel mouth shape estimation
            this.analyser.getByteFrequencyData(this.freqArray);
            const lowFreqSum = this.freqArray.slice(1, 8).reduce((a, b) => a + b, 0);   // ~150Hz - 600Hz
            const highFreqSum = this.freqArray.slice(16, 32).reduce((a, b) => a + b, 0); // ~1.5kHz - 3kHz

            // If higher frequencies dominate (e.g. 'ee', 'i'), mouth widens (positive mouthForm)
            // If lower frequencies dominate (e.g. 'oo', 'oh'), mouth forms rounder shape (subtle negative mouthForm)
            const ratio = (highFreqSum - lowFreqSum) / Math.max(1, highFreqSum + lowFreqSum);
            this.mouthForm = Math.max(-0.6, Math.min(0.8, ratio * 1.5));
        } else {
            // ── Mode B: Procedural Organic Syllable Generator ────────────────
            this.syllableTimer += deltaMs;
            if (this.syllableTimer >= this.syllableDuration) {
                this.syllableTimer = 0;
                this.syllableDuration = 120 + Math.random() * 140; // 120ms - 260ms per syllable
                // Randomized syllable openness (e.g. stressed vs unstressed vowels)
                this.targetAperture = 0.35 + Math.random() * 0.65;
            }

            // Continuous speech modulation wave
            this.proceduralPhase += deltaSeconds * 16.0;
            const carrier = Math.abs(Math.sin(this.proceduralPhase));
            const modulator = 0.7 + 0.3 * Math.sin(this.proceduralPhase * 0.4);

            this.targetVolume = this.targetAperture * carrier * modulator;
            this.mouthForm = Math.sin(this.proceduralPhase * 0.3) * 0.4;
        }

        // Asymmetric attack / decay filtering
        const rate = this.targetVolume > this.mouthOpenY ? this.attackSpeed : this.decaySpeed;
        const factor = 1.0 - Math.exp(-rate * deltaSeconds);
        this.mouthOpenY += (this.targetVolume - this.mouthOpenY) * factor;

        return {
            mouthOpenY: Math.max(0, Math.min(1, this.mouthOpenY)),
            mouthForm: Math.max(-1, Math.min(1, this.mouthForm)),
        };
    }
}
