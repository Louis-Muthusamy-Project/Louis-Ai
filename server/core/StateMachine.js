const EventBus = require("./EventBus");

/**
 * ==========================================
 * Yuna StateMachine - Server Side State Flow
 * ==========================================
 */
class StateMachine {
    constructor() {
        this.states = {
            IDLE: "idle",
            THINKING: "thinking",
            TALKING: "talking",
            EMOTION: "emotion"
        };
        this.currentState = this.states.IDLE;
        this.currentEmotion = "neutral";
    }

    getState() {
        return this.currentState;
    }

    transitionTo(state) {
        if (!Object.values(this.states).includes(state)) {
            throw new Error(`Invalid state transition target: "${state}"`);
        }
        const previousState = this.currentState;
        this.currentState = state;

        EventBus.publish("state:transitioned", {
            from: previousState,
            to: state,
            timestamp: new Date()
        });
    }

    setEmotion(emotion) {
        this.currentEmotion = emotion;
        this.transitionTo(this.states.EMOTION);
    }
}

module.exports = new StateMachine();
