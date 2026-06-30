import { useSyncExternalStore } from "react";

let emotionState = {
    emotion: "neutral",
    intensity: 50,
};

const listeners = new Set();

function emitChange() {
    listeners.forEach((listener) => listener());
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot() {
    return emotionState;
}

function setEmotion(emotion, intensity = 50) {
    emotionState = {
        emotion: emotion || "neutral",
        intensity,
    };

    emitChange();
}

export function useEmotionStore(selector = (state) => state) {
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    return selector({
        ...state,
        setEmotion,
    });
}
