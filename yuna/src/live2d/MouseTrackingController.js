/**
 * ============================================================================
 * MouseTrackingController
 * ============================================================================
 * Converts cursor/touch positions into normalized coordinates [-1, 1],
 * applies dual-stage exponential dampening, and gracefully returns to center
 * upon inactivity.
 */

export class MouseTrackingController {
    constructor() {
        // Current normalized smoothed position [-1, 1]
        this.x = 0;
        this.y = 0;

        // Raw input target
        this.rawTargetX = 0;
        this.rawTargetY = 0;

        // Inactivity management
        this.inactivityTimer = 0;
        this.inactivityThreshold = 3500; // ms
        this.isPointerActive = false;

        // Smoothing speed factor
        this.smoothLambda = 8.0;
    }

    /**
     * Handle pointer move from canvas or window.
     * @param {number} clientX - Screen X coordinate
     * @param {number} clientY - Screen Y coordinate
     * @param {DOMRect} bounds - Canvas bounding client rectangle
     */
    handlePointerMove(clientX, clientY, bounds) {
        if (!bounds || bounds.width === 0 || bounds.height === 0) return;

        // Calculate center of character canvas
        const centerX = bounds.left + bounds.width * 0.5;
        const centerY = bounds.top + bounds.height * 0.5;

        // Normalize to [-1.0, 1.0]
        const maxRadiusX = Math.max(window.innerWidth * 0.5, bounds.width);
        const maxRadiusY = Math.max(window.innerHeight * 0.5, bounds.height);

        const nx = (clientX - centerX) / maxRadiusX;
        const ny = -(clientY - centerY) / maxRadiusY; // Invert Y for 3D coordinate space

        this.rawTargetX = Math.max(-1.0, Math.min(1.0, nx * 1.4));
        this.rawTargetY = Math.max(-1.0, Math.min(1.0, ny * 1.4));

        this.inactivityTimer = 0;
        this.isPointerActive = true;
    }

    /**
     * Handle pointer leave event.
     */
    handlePointerLeave() {
        this.isPointerActive = false;
    }

    /**
     * Update smoothed position per frame.
     * @param {number} deltaSeconds - Delta time in seconds
     */
    update(deltaSeconds) {
        const deltaMs = deltaSeconds * 1000;

        // Track inactivity
        if (this.isPointerActive) {
            this.inactivityTimer += deltaMs;
            if (this.inactivityTimer >= this.inactivityThreshold) {
                this.isPointerActive = false;
            }
        }

        // Target drifts back to (0, 0) if inactive
        const effectiveTargetX = this.isPointerActive ? this.rawTargetX : 0;
        const effectiveTargetY = this.isPointerActive ? this.rawTargetY : 0;

        // Dual-stage exponential smoothing (spring-damper)
        const factor = 1.0 - Math.exp(-this.smoothLambda * deltaSeconds);
        this.x += (effectiveTargetX - this.x) * factor;
        this.y += (effectiveTargetY - this.y) * factor;

        return {
            x: this.x,
            y: this.y,
            isActive: this.isPointerActive,
        };
    }
}
