import YunaEngine from "./YunaEngine";
import { CHARACTER_STATES } from "../constants/characterStates";

class CharacterStateMachine {

    constructor() {

        this.currentState = CHARACTER_STATES.IDLE;

    }

    getState() {

        return this.currentState;

    }

    changeState(state) {

        if (this.currentState === state) {
            return;
        }

        this.currentState = state;

        YunaEngine.setState(state);

    }

    idle() {

        this.changeState(
            CHARACTER_STATES.IDLE
        );

    }

    listening() {

        this.changeState(
            CHARACTER_STATES.LISTENING
        );

    }

    thinking() {

        this.changeState(
            CHARACTER_STATES.THINKING
        );

    }

    talking() {

        this.changeState(
            CHARACTER_STATES.TALKING
        );

    }

    emotion(emotion) {

        switch (emotion) {

            case "happy":
                this.changeState(
                    CHARACTER_STATES.HAPPY
                );
                break;

            case "sad":
                this.changeState(
                    CHARACTER_STATES.SAD
                );
                break;

            case "angry":
                this.changeState(
                    CHARACTER_STATES.ANGRY
                );
                break;

            case "excited":
                this.changeState(
                    CHARACTER_STATES.EXCITED
                );
                break;

            case "confused":
                this.changeState(
                    CHARACTER_STATES.CONFUSED
                );
                break;

            default:
                this.idle();

        }

    }

}

export default new CharacterStateMachine();