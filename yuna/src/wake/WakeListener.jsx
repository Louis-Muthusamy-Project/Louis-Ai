import React, { useEffect, useRef, useState } from "react";

import ElectronService from "../services/electronService";
import { matchWakePhrase, WakeCooldown } from "./wakePhraseMatcher";

const WAKE_COOLDOWN_MS = 3000;
// Chromium's continuous SpeechRecognition periodically ends on its own
// (silence, network hiccup, an internal session limit) even with
// continuous:true - restarting it is what makes listening actually
// continuous rather than a single session that quietly dies after a
// while. A short delay avoids a tight restart loop if it's failing
// repeatedly (e.g. no network for the cloud recognizer).
const RESTART_DELAY_MS = 400;

/**
 * ==========================================
 * WakeListener
 * ------------------------------------------
 * Mounted ONLY in the hidden, always-open wake-listener BrowserWindow
 * (see electron/wake/wakeWindowManager.js) - never inside the main
 * window, never as part of any route. This is what makes wake detection
 * independent of ChatView/CharacterView/CodingView/Settings or whether
 * the main window is even visible: this window's renderer keeps running
 * (and keeps its microphone stream open) regardless of OS focus, as
 * long as the Yuna Electron process itself is alive.
 *
 * HONESTY NOTE: this uses Chromium's built-in SpeechRecognition
 * (cloud-based continuous transcription), not a dedicated low-power
 * offline wake-word engine - see wakePhraseMatcher.js's own note and
 * the implementation report for exactly what a true offline engine
 * (e.g. Picovoice Porcupine with a custom-trained "Thangapila" model)
 * would additionally require.
 * ==========================================
 */
export default function WakeListener() {
    const recognitionRef = useRef(null);
    const cooldownRef = useRef(new WakeCooldown(WAKE_COOLDOWN_MS));
    const enabledRef = useRef(true);
    const restartTimerRef = useRef(null);
    const stoppedRef = useRef(false);
    const [debugStatus, setDebugStatus] = useState("initializing");

    useEffect(() => {
        let cancelled = false;

        function report(status) {
            if (cancelled) return;
            setDebugStatus(status.engineStatus || "unknown");
            ElectronService.reportWakeListenerStatus(status);
        }

        async function primeMicrophonePermission() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                report({ engineStatus: "error", permission: "unknown", microphoneAvailable: false, error: "getUserMedia is unavailable in this renderer." });
                return false;
            }
            try {
                // SpeechRecognition manages its own audio capture and does
                // NOT accept this stream directly - this call exists purely
                // to (a) trigger the real OS/browser microphone permission
                // prompt up front and (b) let us report an honest
                // granted/denied/unavailable status, rather than only
                // finding out indirectly when SpeechRecognition itself
                // fails later.
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach((track) => track.stop());
                report({ engineStatus: "initializing", permission: "granted", microphoneAvailable: true, error: null });
                return true;
            } catch (error) {
                const denied = error && (error.name === "NotAllowedError" || error.name === "SecurityError");
                const unavailable = error && (error.name === "NotFoundError" || error.name === "DevicesNotFoundError");
                report({
                    engineStatus: "error",
                    permission: denied ? "denied" : "unknown",
                    microphoneAvailable: unavailable ? false : null,
                    error: error && error.message
                });
                return false;
            }
        }

        function scheduleRestart() {
            if (stoppedRef.current || cancelled) return;
            clearTimeout(restartTimerRef.current);
            restartTimerRef.current = setTimeout(() => {
                if (!stoppedRef.current && enabledRef.current) startRecognition();
            }, RESTART_DELAY_MS);
        }

        function startRecognition() {
            if (cancelled || stoppedRef.current || !enabledRef.current) return;

            const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognitionCtor) {
                report({ engineStatus: "error", permission: "unknown", microphoneAvailable: null, error: "SpeechRecognition is unavailable in this Electron/Chromium build." });
                return;
            }

            const recognition = new SpeechRecognitionCtor();
            recognition.lang = "en-US";
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                report({ engineStatus: "listening", permission: "granted", microphoneAvailable: true, error: null });
            };

            recognition.onresult = (event) => {
                if (!enabledRef.current) return;
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    const match = matchWakePhrase(transcript);
                    if (match && cooldownRef.current.tryTrigger()) {
                        ElectronService.requestWakePopup({
                            phraseId: match.id,
                            transcript: match.normalizedTranscript
                        });
                    }
                }
            };

            recognition.onerror = (event) => {
                if (event.error === "not-allowed" || event.error === "service-not-allowed") {
                    report({ engineStatus: "error", permission: "denied", microphoneAvailable: null, error: event.error });
                    // Permission was actively denied - retrying immediately
                    // would just error again forever, so stop instead of
                    // scheduling a restart; the user has to re-grant it
                    // (OS/browser mic permission) and toggle wake back on.
                    stoppedRef.current = true;
                    return;
                }
                if (event.error !== "no-speech" && event.error !== "aborted") {
                    report({ engineStatus: "error", permission: "granted", microphoneAvailable: true, error: event.error });
                }
                // "no-speech"/"aborted" are routine for a continuous
                // listener with silence in the room - not worth
                // reporting as an error, just restart below like any
                // other natural session end.
            };

            recognition.onend = () => {
                if (!cancelled && enabledRef.current && !stoppedRef.current) {
                    scheduleRestart();
                }
            };

            recognitionRef.current = recognition;
            try {
                recognition.start();
            } catch {
                // start() throws if called while a previous session on the
                // same object is still finishing up - the scheduled
                // restart below will retry shortly.
                scheduleRestart();
            }
        }

        function stopRecognition() {
            stoppedRef.current = true;
            clearTimeout(restartTimerRef.current);
            recognitionRef.current?.stop();
            recognitionRef.current = null;
            report({ engineStatus: "stopped", permission: "granted", microphoneAvailable: true, error: null });
        }

        (async () => {
            const settings = await ElectronService.getWakeSettings();
            enabledRef.current = settings ? settings.enabled !== false : true;
            if (cancelled) return;

            if (!enabledRef.current) {
                report({ engineStatus: "stopped", permission: "unknown", microphoneAvailable: null, error: null });
                return;
            }

            const primed = await primeMicrophonePermission();
            if (cancelled || !primed) return;
            stoppedRef.current = false;
            startRecognition();
        })();

        ElectronService.onWakeSettingsChanged((next) => {
            enabledRef.current = !!(next && next.enabled);
            if (enabledRef.current) {
                stoppedRef.current = false;
                startRecognition();
            } else {
                stopRecognition();
            }
        });

        return () => {
            cancelled = true;
            stopRecognition();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // This window is never shown (see wakeWindowManager.js:
    // ensureListenerWindow creates it with show:false and it's never
    // told to show) - this markup only matters if someone opens
    // DevTools on it directly for debugging, so it stays minimal.
    return (
        <div style={{ padding: 12, fontFamily: "monospace", fontSize: 12, color: "#9ca3af" }}>
            Yuna wake listener - status: {debugStatus}
        </div>
    );
}
