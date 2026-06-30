export function speakText(text) {
    if (!("speechSynthesis" in window)) {
        console.warn("Speech not supported");
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = 1;
    utterance.pitch = 1.2; // anime-like voice feel
    utterance.volume = 1;

    // Optional: choose voice
    const voices = speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => v.name.includes("female"));

    if (femaleVoice) {
        utterance.voice = femaleVoice;
    }

    speechSynthesis.speak(utterance);

    return utterance;
}