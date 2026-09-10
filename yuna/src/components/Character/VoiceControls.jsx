import React, { useState } from "react";
import { Button, Select, Tooltip, Alert } from "antd";
import { AudioOutlined, StopOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";

import useSpeechRecognition, { SUPPORTED_VOICE_LANGUAGES } from "../../hooks/useSpeechRecognition";
import SocketService from "../../services/socketService";
import VoiceService from "../../services/voiceService";
import useChatStore from "../../store/chatStore";
import CharacterStateMachine from "../../core/CharacterStateMachine";

import styles from "./voiceControls.module.css";

/**
 * ==========================================
 * VoiceControls
 * ------------------------------------------
 * The actual voice-to-voice loop for the Character tab:
 *
 *   mic press -> useSpeechRecognition (real browser STT, no temp files)
 *   -> final transcript -> yuna:message:send (SAME event ChatComposer uses)
 *   -> AIOrchestrator processes it exactly like typed text
 *   -> reply's audio comes back via the EXISTING voice:audio pipeline
 *      (already wired in ChatProvider.jsx -> VoiceService.speak() ->
 *      AudioQueue -> Live2DManager's analyser -> LipSyncEngine)
 *   -> Live2D speaks with real audio-driven lip-sync
 *
 * Nothing here reimplements AI response, TTS, or lip-sync - it only adds
 * the missing input leg and reuses everything else that already exists
 * and already works for the Chat tab.
 *
 * Cancellation: pressing mic while a reply is still being generated/
 * spoken interrupts it FIRST (same yuna:stream:cancel + VoiceService.stop()
 * ChatComposer's stop button uses) before starting to listen again - a new
 * request always wins over a stale one, and stale audio/speaking state
 * never lingers.
 * ==========================================
 */
export default function VoiceControls() {
    const [lang, setLang] = useState(SUPPORTED_VOICE_LANGUAGES[0].code);
    const { supported, listening, interimTranscript, error, start, stop } = useSpeechRecognition();

    const typing = useChatStore(state => state.typing);
    const thinking = useChatStore(state => state.thinking);
    const setTyping = useChatStore(state => state.setTyping);
    const setThinking = useChatStore(state => state.setThinking);
    const addMessage = useChatStore(state => state.addMessage);
    const connected = useChatStore(state => state.connected);

    const busy = typing || thinking;

    function interruptInFlightReply() {
        if (!busy) return;
        SocketService.emit("yuna:stream:cancel");
        setTyping(false);
        setThinking(false);
        VoiceService.stop();
        CharacterStateMachine.idle();
    }

    function handleFinalTranscript(text) {
        if (!text) return;
        if (!SocketService.isConnected()) return;

        const id = crypto.randomUUID();
        addMessage({ id, role: "user", text, createdAt: new Date().toISOString() });
        SocketService.emit("yuna:message:send", { id, text });
    }

    function toggleListening() {
        if (listening) {
            stop();
            CharacterStateMachine.idle();
            return;
        }
        // A new voice turn always takes priority over a stale one.
        interruptInFlightReply();
        CharacterStateMachine.listening();
        start(lang, handleFinalTranscript);
    }

    if (!supported) {
        return (
            <div className={styles.wrap}>
                <Alert
                    type="warning"
                    showIcon
                    message="Voice input isn't available in this browser."
                    description="Speech recognition requires a Chromium-based browser (Electron uses this by default). Text chat still works on the Chat tab."
                />
            </div>
        );
    }

    return (
        <div className={styles.wrap}>
            <Select
                size="small"
                className={styles.langSelect}
                value={lang}
                onChange={setLang}
                disabled={listening}
                options={SUPPORTED_VOICE_LANGUAGES.map(l => ({ value: l.code, label: l.label }))}
            />

            <Tooltip title={listening ? "Stop listening" : "Start speaking"}>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ display: "inline-flex" }}>
                    <Button
                        shape="circle"
                        size="large"
                        danger={listening}
                        type={listening ? "default" : "primary"}
                        icon={listening ? <StopOutlined /> : <AudioOutlined />}
                        onClick={toggleListening}
                        disabled={!connected}
                    />
                </motion.div>
            </Tooltip>

            <div className={styles.status}>
                {listening && (interimTranscript || "Listening…")}
                {!listening && busy && "Yuna is responding…"}
                {!listening && !busy && !error && "Press the mic to talk"}
                {error && <span className={styles.error}>{error}</span>}
            </div>
        </div>
    );
}
