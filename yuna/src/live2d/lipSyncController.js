export class LipSyncController {
    constructor(model) {
        this.model = model;
        this.isSpeaking = false;
    }

    start() {
        this.isSpeaking = true;
        this.animate();
    }

    stop() {
        this.isSpeaking = false;

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

        requestAnimationFrame(() => this.animate());
    }
}