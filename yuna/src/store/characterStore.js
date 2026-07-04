import { create } from "zustand";

const useCharacterStore = create((set) => ({

    emotion: "idle",

    animation: "idle",

    speaking: false,

    blinking: true,

    breathing: true,

    eyeDirection: "center",

    setEmotion(emotion) {

        set({

            emotion

        });

    },

    setAnimation(animation) {

        set({

            animation

        });

    },

    setSpeaking(value) {

        set({

            speaking: value

        });

    },

    setBlinking(value) {

        set({

            blinking: value

        });

    },

    setBreathing(value) {

        set({

            breathing: value

        });

    },

    setEyeDirection(direction) {

        set({

            eyeDirection: direction

        });

    }

}));

export default useCharacterStore;