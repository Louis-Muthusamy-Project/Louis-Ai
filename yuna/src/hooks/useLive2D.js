import { useEffect } from "react";
import { useEmotionStore } from "../store/emotionStore";

export function useLive2D(controller) {
    const emotion = useEmotionStore((s) => s.emotion);
    const intensity = useEmotionStore((s) => s.intensity);

    useEffect(() => {
        if (!controller) return;

        controller.setEmotion(emotion);
        controller.setIntensity(intensity);

    }, [emotion, intensity]);
}