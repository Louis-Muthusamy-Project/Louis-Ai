import useYunaEngine from "./useYunaEngine";

export default function useCharacterState() {

    const { state, setState } = useYunaEngine();

    return {

        state,

        setState,

        isIdle: state === "idle",

        isListening: state === "listening",

        isThinking: state === "thinking",

        isTalking: state === "talking",

        isHappy: state === "happy",

        isSad: state === "sad",

        isAngry: state === "angry",

        isExcited: state === "excited",

        isConfused: state === "confused"

    };

}