import { useEmotionStore } from "../store/emotionStore";
import { speakText } from "../voice/voiceService";

const setEmotion = useEmotionStore((s) => s.setEmotion);

socket.on("yuna_reply", (data) => {
    setMessages((prev) => [
        ...prev,
        {
            role: "ai",
            text: data.message,
        },
    ]);

    const utterance = speakText(data.message);

    window.dispatchEvent(new CustomEvent("yuna_speaking", {
        detail: { speaking: true }
    }));

    utterance.onend = () => {
        window.dispatchEvent(new CustomEvent("yuna_speaking", {
            detail: { speaking: false }
        }));
    };

    // 🎭 Emotion sync
    if (data.emotion) {
        setEmotion(data.emotion, data.intensity);
    }
});