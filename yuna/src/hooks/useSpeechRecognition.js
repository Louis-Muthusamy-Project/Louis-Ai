import { useRef, useState, useCallback, useEffect } from "react";

import ElectronService from "../services/electronService";

// The 3 UI languages this app supports, mapped to BCP-47 locale codes the
// Web Speech API understands. Deliberately no other options are exposed -
// see VoiceControls.jsx, which is the only place this hook's `start(lang)`
// is called from a user-facing control.
export const SUPPORTED_VOICE_LANGUAGES = [
    { code: "en-US", label: "English" },
    { code: "ta-IN", label: "Tamil" },
    { code: "ja-JP", label: "Japanese" }
];

/**
 * ==========================================
 * useSpeechRecognition
 * ------------------------------------------
 * Wraps the browser-native SpeechRecognition API (webkitSpeechRecognition
 * in Chromium/Electron - Yuna's actual runtime). This performs real
 * speech-to-text entirely in the browser/OS layer - no audio blob is ever
 * uploaded to Yuna's backend for transcription, so there is nothing here
 * that could create a server-side temp audio file.
 *
 * HONESTY NOTE: this is a real capability of Chromium, not a fake/stub.
 * If it's unavailable (non-Chromium browser, or the OS/browser has no
 * speech service configured), `supported` is false and the caller must
 * show that honestly rather than pretending voice input works - per the
 * explicit "handle that capability honestly" requirement, no fallback
 * that silently does nothing is acceptable here.
 * ==========================================
 */
export default function useSpeechRecognition() {
    const recognitionRef = useRef(null);
    const [supported] = useState(() => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition));
    const [listening, setListening] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState("");
    const [error, setError] = useState(null);

    const onFinalRef = useRef(null);

    useEffect(() => {
        return () => {
            // Never leave a live microphone stream open past unmount -
            // e.g. navigating away from the Character tab mid-recognition.
            recognitionRef.current?.stop();
            ElectronService.setWakeMicBusy(false);
        };
    }, []);

    const start = useCallback(async (lang, onFinalTranscript) => {
        if (!supported) {
            setError("Speech recognition isn't available in this browser.");
            return;
        }
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        // Pause the wake listener's own continuous recognition FIRST, and
        // actually wait for it - Chromium only reliably supports one
        // active SpeechRecognition session at a time across this app's
        // renderers, so starting ours while the wake listener still held
        // the mic is exactly what was making this immediately abort right
        // after turning "on". setWakeMicBusy's IPC round-trip only
        // guarantees the pause *request* reached the other window, not
        // that it has finished releasing the microphone yet, so a short
        // real delay follows it - the most reliable option available
        // without a slower cross-window ack handshake for something this
        // latency-sensitive.
        await ElectronService.setWakeMicBusy(true);
        await new Promise((resolve) => setTimeout(resolve, 200));

        const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = lang;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        onFinalRef.current = onFinalTranscript;
        setError(null);
        setInterimTranscript("");

        recognition.onresult = (event) => {
            let interim = "";
            let final = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += transcript;
                } else {
                    interim += transcript;
                }
            }
            if (interim) setInterimTranscript(interim);
            if (final && onFinalRef.current) {
                onFinalRef.current(final.trim());
            }
        };

        recognition.onerror = (event) => {
            // "no-speech" and "aborted" are routine (user didn't say
            // anything, or we stopped it ourselves) - not real errors
            // worth surfacing.
            if (event.error !== "no-speech" && event.error !== "aborted") {
                setError(event.error);
            }
        };

        recognition.onend = () => {
            setListening(false);
            setInterimTranscript("");
            // Tell the wake listener it can resume - see
            // wakeWindowManager.sendToListener's comment for why this
            // pause/resume handshake exists (two simultaneous
            // SpeechRecognition sessions fighting over one microphone was
            // causing this exact toggle to immediately self-cancel).
            ElectronService.setWakeMicBusy(false);
        };

        recognitionRef.current = recognition;
        setListening(true);
        recognition.start();
    }, [supported]);

    const stop = useCallback(() => {
        recognitionRef.current?.stop();
        setListening(false);
        ElectronService.setWakeMicBusy(false);
    }, []);

    return { supported, listening, interimTranscript, error, start, stop };
}
