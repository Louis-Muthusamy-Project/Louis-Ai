/**
 * ============================================================================
 * PhysicsController
 * ============================================================================
 * Coordinates Cubism 3 physics calculation for hair strands, ribbons, and cloth.
 * Injects dynamic velocity impulses when the head or body rotates quickly.
 */

export class PhysicsController {
    constructor(model = null) {
        this.model = model;
        this.lastAngleX = 0;
        this.lastAngleY = 0;
        this.lastAngleZ = 0;
        this.velocityImpulseX = 0;
        this.velocityImpulseY = 0;
    }

    setModel(model) {
        this.model = model;
    }

    /**
     * Update physics calculation and inject acceleration momentum.
     * @param {number} deltaSeconds - Delta time in seconds
     * @param {object} currentAngles - Current head/body angles { angleX, angleY, angleZ }
     * @param {object} emotionState - 9-axis emotion state
     */
    update(deltaSeconds, currentAngles = {}, emotionState = {}) {
        if (!this.model || deltaSeconds <= 0) return;

        const { angleX = 0, angleY = 0, angleZ = 0 } = currentAngles;

        // Calculate angular acceleration / velocity impulse
        const velX = (angleX - this.lastAngleX) / deltaSeconds;
        const velY = (angleY - this.lastAngleY) / deltaSeconds;

        this.lastAngleX = angleX;
        this.lastAngleY = angleY;
        this.lastAngleZ = angleZ;

        // Exponential decay of physical momentum
        this.velocityImpulseX = this.velocityImpulseX * 0.85 + velX * 0.15;
        this.velocityImpulseY = this.velocityImpulseY * 0.85 + velY * 0.15;

        // Cubism physics is natively stepped by internalModel.update()
        // If internal physics rig is accessible, we can tune physics scale
        if (this.model.internalModel && this.model.internalModel.physics) {
            const { energy = 0.5 } = emotionState;
            // Higher emotional energy increases hair responsiveness
            const energyScale = 0.9 + energy * 0.3;
            if (this.model.internalModel.physics.timeScale !== undefined) {
                this.model.internalModel.physics.timeScale = energyScale;
            }
        }
    }
}
