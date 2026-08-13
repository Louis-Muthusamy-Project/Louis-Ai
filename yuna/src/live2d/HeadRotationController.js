/**
 * ============================================================================
 * HeadRotationController
 * ============================================================================
 * Calculates 3D head and body orientation by harmonizing mouse tracking,
 * emotional posture tilts, speech cadence nods, and natural physics damping.
 *
 * Parameters controlled:
 * - ParamAngleX (-30 to 30 deg)
 * - ParamAngleY (-30 to 30 deg)
 * - ParamAngleZ (-30 to 30 deg)
 * - ParamBodyAngleX (-10 to 10 deg)
 * - ParamBodyAngleY (-10 to 10 deg)
 * - ParamBodyAngleZ (-10 to 10 deg)
 */

export class HeadRotationController {
    constructor() {
        // Current smoothed head angles
        this.angleX = 0;
        this.angleY = 0;
        this.angleZ = 0;

        // Current smoothed body angles
        this.bodyAngleX = 0;
        this.bodyAngleY = 0;
        this.bodyAngleZ = 0;

        // Speech rhythm nod state
        this.speechNodPhase = 0;
        this.speechNodIntensity = 0;

        // Smooth damping rate
        this.smoothLambda = 9.0;
    }

    /**
     * Update head and body orientation per frame.
     * @param {number} deltaSeconds - Delta time in seconds
     * @param {object} mousePos - Normalized mouse position { x, y } in [-1, 1]
     * @param {object} emotionState - 9-axis emotion state
     * @param {boolean} isSpeaking - Whether speech is active
     */
    update(deltaSeconds, mousePos = { x: 0, y: 0 }, emotionState = {}, isSpeaking = false) {
        const { primary, joy = 0.5, stress = 0.1, curiosity = 0.5 } = emotionState;

        // ── 1. Base pointer look-at angles ──────────────────────────────────
        // Mouse X drives AngleX (-30 to +30), Mouse Y drives AngleY (-30 to +30)
        let targetAngleX = (mousePos.x || 0) * 25.0;
        let targetAngleY = (mousePos.y || 0) * 22.0;
        let targetAngleZ = (mousePos.x || 0) * -10.0; // Natural counter-tilt when looking sideways

        // ── 2. Emotional posture offsets ────────────────────────────────────
        let emotionOffsetX = 0;
        let emotionOffsetY = 0;
        let emotionOffsetZ = 0;

        if (primary === "curious" || curiosity > 0.7) {
            // Inquisitive head tilt (ParamAngleZ) and slight chin raise
            emotionOffsetZ += 12.0;
            emotionOffsetY += 3.0;
        } else if (primary === "happy" || joy > 0.7) {
            // Cheerful uplifted chin and subtle playful tilt
            emotionOffsetY += 4.0;
            emotionOffsetZ += Math.sin(Date.now() * 0.002) * 3.0;
        } else if (primary === "excited") {
            // Bouncy, lively head angles
            emotionOffsetY += 6.0;
            emotionOffsetZ += Math.sin(Date.now() * 0.004) * 5.0;
        } else if (primary === "thinking") {
            // Classic contemplative pose: head tilted up & to the side
            emotionOffsetX += 8.0;
            emotionOffsetY += 10.0;
            emotionOffsetZ -= 8.0;
        } else if (primary === "sad") {
            // Downcast head, chin lowered
            emotionOffsetY -= 12.0;
            emotionOffsetX *= 0.5; // Reduced sideways movement
        } else if (primary === "anxious" || stress > 0.6) {
            // Tense, slightly lowered head with nervous micro-twitch
            emotionOffsetY -= 4.0;
            emotionOffsetZ += Math.sin(Date.now() * 0.008) * 1.5;
        } else if (primary === "angry") {
            // Furrowed forward pitch
            emotionOffsetY -= 6.0;
        }

        // ── 3. Speech cadence nods ──────────────────────────────────────────
        let speechNodOffsetY = 0;
        let speechNodOffsetZ = 0;

        if (isSpeaking) {
            this.speechNodIntensity = Math.min(1.0, this.speechNodIntensity + deltaSeconds * 4.0);
            this.speechNodPhase += deltaSeconds * 6.5; // Natural conversational cadence ~1 Hz

            // Organic asymmetric head nod: faster downward nod, slower upward bounce
            const rawNod = Math.sin(this.speechNodPhase);
            speechNodOffsetY = (rawNod > 0 ? rawNod * 3.5 : rawNod * 2.0) * this.speechNodIntensity;
            speechNodOffsetZ = Math.cos(this.speechNodPhase * 0.5) * 2.0 * this.speechNodIntensity;
        } else {
            this.speechNodIntensity = Math.max(0.0, this.speechNodIntensity - deltaSeconds * 3.0);
            if (this.speechNodIntensity > 0) {
                speechNodOffsetY = Math.sin(this.speechNodPhase) * 2.0 * this.speechNodIntensity;
            }
        }

        // ── 4. Combine all layers ────────────────────────────────────────────
        const finalTargetAngleX = Math.max(-30, Math.min(30, targetAngleX + emotionOffsetX));
        const finalTargetAngleY = Math.max(-30, Math.min(30, targetAngleY + emotionOffsetY + speechNodOffsetY));
        const finalTargetAngleZ = Math.max(-30, Math.min(30, targetAngleZ + emotionOffsetZ + speechNodOffsetZ));

        // ── 5. Exponential spring-damper smoothing ──────────────────────────
        const factor = 1.0 - Math.exp(-this.smoothLambda * deltaSeconds);
        this.angleX += (finalTargetAngleX - this.angleX) * factor;
        this.angleY += (finalTargetAngleY - this.angleY) * factor;
        this.angleZ += (finalTargetAngleZ - this.angleZ) * factor;

        // ── 6. Body orientation (smoothly lags head rotation) ────────────────
        const bodyFactor = 1.0 - Math.exp(-4.5 * deltaSeconds);
        const targetBodyX = this.angleX * 0.35;
        const targetBodyY = this.angleY * 0.25;
        const targetBodyZ = this.angleZ * 0.20;

        this.bodyAngleX += (targetBodyX - this.bodyAngleX) * bodyFactor;
        this.bodyAngleY += (targetBodyY - this.bodyAngleY) * bodyFactor;
        this.bodyAngleZ += (targetBodyZ - this.bodyAngleZ) * bodyFactor;

        return {
            angleX: this.angleX,
            angleY: this.angleY,
            angleZ: this.angleZ,
            bodyAngleX: this.bodyAngleX,
            bodyAngleY: this.bodyAngleY,
            bodyAngleZ: this.bodyAngleZ,
        };
    }
}
