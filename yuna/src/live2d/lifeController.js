export class LifeController {
    constructor(model) {
        this.model = model;

        this.breath = 0;
        this.blinkTimer = 0;
        this.isBlinking = false;
    }

    update(deltaTime) {
        this.handleBreathing(deltaTime);
        this.handleBlinking(deltaTime);
        this.handleIdleMotion(deltaTime);
    }

    // 🌬️ Breathing animation
    handleBreathing(deltaTime) {
        this.breath += deltaTime * 0.002;

        const scale = 1 + Math.sin(this.breath) * 0.01;

        if (this.model) {
            this.model.scale = scale;
        }
    }

    // 👁️ Blinking animation
    handleBlinking(deltaTime) {
        this.blinkTimer += deltaTime;

        if (this.blinkTimer > 3000 && !this.isBlinking) {
            this.isBlinking = true;

            if (this.model) {
                this.model.eyeOpen = 0;
            }

            setTimeout(() => {
                if (this.model) {
                    this.model.eyeOpen = 1;
                }

                this.isBlinking = false;
                this.blinkTimer = 0;
            }, 150);
        }
    }

    // 🌀 Idle motion (subtle sway)
    handleIdleMotion(_deltaTime) {
        const sway = Math.sin(Date.now() * 0.001) * 0.02;

        if (this.model) {
            this.model.rotation = sway;
        }
    }
}
