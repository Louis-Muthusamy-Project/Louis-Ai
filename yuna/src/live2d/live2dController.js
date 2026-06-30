export class Live2DController {
    constructor(model) {
        this.model = model;
    }

    setEmotion(emotion) {
        switch (emotion) {
            case "happy":
                this.model.expression = "happy";
                break;

            case "sad":
                this.model.expression = "sad";
                break;

            case "angry":
                this.model.expression = "angry";
                break;

            case "excited":
                this.model.expression = "excited";
                break;

            default:
                this.model.expression = "neutral";
        }
    }

    setIntensity(intensity) {
        // Future: control eye size / breathing / motion speed
        this.model.intensity = intensity;
    }
}