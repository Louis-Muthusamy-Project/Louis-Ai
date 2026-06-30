import { create } from "zustand";

export const useEmotionStore = create((set) => ({
    emotion: "neutral",
    intensity: 50,

    setEmotion: (emotion, intensity) =>
        set({ emotion, intensity }),
}));