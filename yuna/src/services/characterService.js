import CharacterStateMachine from "../core/CharacterStateMachine";
import useCharacterStore from "../store/characterStore";

class CharacterService {

    idle() {

        CharacterStateMachine.idle();

        useCharacterStore.getState()

            .setAnimation("idle");

    }

    thinking() {

        CharacterStateMachine.thinking();

        useCharacterStore.getState()

            .setAnimation("thinking");

    }

    talking() {

        CharacterStateMachine.talking();

        useCharacterStore.getState()

            .setAnimation("talking");

    }

    emotion(name) {

        CharacterStateMachine.emotion(name);

        useCharacterStore.getState()

            .setEmotion(name);

    }

}

export default new CharacterService();