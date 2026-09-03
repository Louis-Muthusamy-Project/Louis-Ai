import { create } from "zustand";

const useChatStore = create((set) => ({

    messages: [],

    streamingText: "",

    thinking: false,

    connected: false,

    emotion: "idle",

    voiceState: "idle",

    audioQueue: [],

    currentAudio: null,

    typing: false,

    setVoiceSpeaking() {

        set({

            voiceState: "speaking"

        });

    },

    setVoiceIdle() {

        set({

            voiceState: "idle"

        });

    },

    addMessage(message) {

        set(state => ({

            messages: [

                ...state.messages,

                message

            ]

        }));

    },

    updateMessage(id, patch) {

        set(state => ({

            messages: state.messages.map(m =>
                m.id === id ? { ...m, ...patch } : m
            )

        }));

    },

    clearMessages() {

        set({

            messages: []

        });

    },

    setStreamingText(text) {

        set({

            streamingText: text

        });

    },

    setThinking(value) {

        set({

            thinking: value

        });

    },

    setTyping(value) {

        set({

            typing: value

        });

    },

    setConnected(value) {

        set({

            connected: value

        });

    },

    setEmotion(value) {

        set({

            emotion: value

        });

    },

    setVoiceState(value) {

        set({

            voiceState: value

        });

    },
    reset() {

        set({

            messages: [],

            streamingText: "",

            thinking: false,

            typing: false,

            emotion: "idle",

            voiceState: "idle"

        });

    }

}));

export default useChatStore;