/**
 * ============================================================================
 * IdleMotionManager
 * ============================================================================
 * Coordinates ambient life behaviors:
 * 1. Continuous procedural Lissajous drift for body and head.
 * 2. Periodic ambient motion clip scheduling with emotion-weighted selection.
 */

import { HIYORI_MOTIONS, MOTION_PRIORITY } from "./MotionController";

export class IdleMotionManager {
    constructor(motionController = null) {
        this.motionController = motionController;

        // Ambient motion timer
        this.minCooldown = 14000; // 14s
        this.maxCooldown = 28000; // 28s
        this.timer = 0;
        this.nextMotionDelay = this._getRandomDelay();

        // Lissajous continuous drift phases
        this.driftPhaseX = Math.random() * Math.PI * 2;
        this.driftPhaseY = Math.random() * Math.PI * 2;
        this.driftPhaseZ = Math.random() * Math.PI * 2;

        // Enabled state
        this.enabled = true;
    }

    setMotionController(controller) {
        this.motionController = controller;
    }

    _getRandomDelay() {
        return this.minCooldown + Math.random() * (this.maxCooldown - this.minCooldown);
    }

    /**
     * Update ambient idle loop per frame.
     * @param {number} deltaSeconds - Delta time in seconds
     * @param {object} emotionState - 9-axis emotion state
     * @param {boolean} isSpeaking - Whether speech is active
     */
    update(deltaSeconds, emotionState = {}, isSpeaking = false) {
        const deltaMs = deltaSeconds * 1000;
        const { primary = "neutral", energy = 0.5 } = emotionState;

        // ── 1. Calculate continuous micro-drift (Lissajous curves) ──────────
        // Drift frequency scales with energy
        const speed = 0.4 + (energy - 0.5) * 0.2;
        this.driftPhaseX += deltaSeconds * speed * 0.9;
        this.driftPhaseY += deltaSeconds * speed * 1.3;
        this.driftPhaseZ += deltaSeconds * speed * 0.7;

        // Organic multi-frequency swaying angles (small degrees)
        const driftAngleX = Math.sin(this.driftPhaseX) * 1.8 + Math.sin(this.driftPhaseX * 2.3) * 0.6;
        const driftAngleY = Math.sin(this.driftPhaseY) * 1.4 + Math.cos(this.driftPhaseY * 1.7) * 0.5;
        const driftAngleZ = Math.sin(this.driftPhaseZ) * 1.2;

        // ── 2. Periodic ambient motion clip triggering ──────────────────────
        if (this.enabled && this.motionController && !isSpeaking) {
            this.timer += deltaMs;
            if (this.timer >= this.nextMotionDelay) {
                this.timer = 0;
                this.nextMotionDelay = this._getRandomDelay();

                // Trigger emotion-weighted ambient motion
                this._triggerWeightedMotion(primary);
            }
        }

        return {
            driftAngleX,
            driftAngleY,
            driftAngleZ,
        };
    }

    _triggerWeightedMotion(primary) {
        if (!this.motionController || this.motionController.isPlaying) return;

        let candidateList = [];

        if (primary === "happy" || primary === "excited") {
            candidateList = [
                HIYORI_MOTIONS.IDLE_HAPPY_1,
                HIYORI_MOTIONS.IDLE_HAPPY_2,
                HIYORI_MOTIONS.IDLE_EXCITED,
                HIYORI_MOTIONS.IDLE_CALM,
            ];
        } else if (primary === "thinking" || primary === "focused") {
            candidateList = [
                HIYORI_MOTIONS.IDLE_THINKING,
                HIYORI_MOTIONS.IDLE_CALM,
                HIYORI_MOTIONS.IDLE_LOOK,
            ];
        } else if (primary === "curious") {
            candidateList = [
                HIYORI_MOTIONS.IDLE_CURIOUS,
                HIYORI_MOTIONS.IDLE_LOOK,
                HIYORI_MOTIONS.IDLE_HAPPY_1,
            ];
        } else if (primary === "sad" || primary === "anxious") {
            candidateList = [
                HIYORI_MOTIONS.IDLE_SAD,
                HIYORI_MOTIONS.IDLE_CALM,
                HIYORI_MOTIONS.IDLE_RELAX,
            ];
        } else {
            // Neutral / default pool
            candidateList = [
                HIYORI_MOTIONS.IDLE_CALM,
                HIYORI_MOTIONS.IDLE_RELAX,
                HIYORI_MOTIONS.IDLE_LOOK,
                HIYORI_MOTIONS.IDLE_HAPPY_1,
            ];
        }

        const picked = candidateList[Math.floor(Math.random() * candidateList.length)];
        this.motionController.playMotion(picked.group, picked.index, MOTION_PRIORITY.IDLE);
    }
}
