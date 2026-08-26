import { useEffect, useState } from "react";
import EmotionEngine from "../core/EmotionEngine";
import YunaEngine from "../core/YunaEngine";

export default function useEmotionState() {
    const [emotionState, setEmotionState] = useState(EmotionEngine.getState());

    useEffect(() => {
        const handleEmotionUpdate = (state) => {
            setEmotionState({ ...state });
        };

        // Subscribe via YunaEngine bus
        YunaEngine.on("emotion", handleEmotionUpdate);

        return () => {
            YunaEngine.off("emotion", handleEmotionUpdate);
        };
    }, []);

    // Pre-computed helpers for component use
    const { primary, joy, stress, energy, curiosity, trust, mood, confidence, focus, attachment } = emotionState;

    return {
        // Full state
        emotionState,
        // Primary named emotion
        primary,
        // Raw axes [0..1]
        joy,
        stress,
        energy,
        curiosity,
        trust,
        mood,
        confidence,
        focus,
        attachment,
        // Convenience booleans
        isHappy:   primary === "happy",
        isExcited: primary === "excited",
        isSad:     primary === "sad",
        isAngry:   primary === "angry",
        isAnxious: primary === "anxious",
        isCurious: primary === "curious",
        isFocused: primary === "focused",
        isNeutral: primary === "neutral",
        // Helpers
        animProps: EmotionEngine.getAnimationProps()
    };
}