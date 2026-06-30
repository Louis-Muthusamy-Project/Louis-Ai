export class LipSyncController {
    constructor(model) {
        this.model = model;
        this.isSpeaking = false;
        this.animationFrameId = null;
    }

    start() {
        if (this.isSpeaking) return;

        this.isSpeaking = true;
        this.animate();
    }

    stop() {
        this.isSpeaking = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.model) {
            this.model.mouthOpen = 0;
        }
    }

    animate() {
        if (!this.isSpeaking) return;

        const value = Math.abs(Math.sin(Date.now() * 0.02));

        if (this.model) {
            this.model.mouthOpen = value;
        }

        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
}
