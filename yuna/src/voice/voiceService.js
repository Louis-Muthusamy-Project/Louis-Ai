let voicesLoaded = false;

function getVoices() {
    const voices = window.speechSynthesis.getVoices();

    if (voices.length) {
        voicesLoaded = true;
    }

    return voices;
}

export function speakText(text) {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) {
        console.warn("Speech not supported");
        return null;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = 1;
    utterance.pitch = 1.2; // anime-like voice feel
    utterance.volume = 1;

    const voices = getVoices();
    const preferredVoice = voices.find((voice) =>
        /female|zira|samantha|aria|natural/i.test(voice.name)
    );

    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    const speak = () => window.speechSynthesis.speak(utterance);

    if (!voicesLoaded && "onvoiceschanged" in window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => {
            voicesLoaded = true;
            speak();
            window.speechSynthesis.onvoiceschanged = null;
        };
    } else {
        speak();
    }

    return utterance;
}
