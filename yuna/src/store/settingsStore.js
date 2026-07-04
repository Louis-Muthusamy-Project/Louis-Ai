import { create } from "zustand";

const DEFAULT_SETTINGS = {

    theme: "dark",

    provider: "gemini",

    model: "gemini-2.5-flash",

    voice: "edge",

    voiceName: "en-US-AvaMultilingualNeural",

    streamSpeed: 30,

    memory: true,

    debug: false

};

const useSettingsStore = create((set) => ({

    loading: false,

    settings: DEFAULT_SETTINGS,

    setLoading(value) {

        set({

            loading: value

        });

    },

    setSettings(settings) {

        set({

            settings: {

                ...DEFAULT_SETTINGS,

                ...settings

            }

        });

    },

    updateSetting(key, value) {

        set(state => ({

            settings: {

                ...state.settings,

                [key]: value

            }

        }));

    },

    reset() {

        set({

            settings: DEFAULT_SETTINGS

        });

    }

}));

export default useSettingsStore;