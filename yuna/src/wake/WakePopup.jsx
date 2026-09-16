import React, { useEffect, useRef, useState } from "react";
import { Input, Button, Tooltip } from "antd";
import { CloseOutlined, SendOutlined, AudioOutlined, ReloadOutlined, PictureOutlined } from "@ant-design/icons";

import useAuthStore from "../store/authStore";
import SocketService from "../services/socketService";
import ElectronService from "../services/electronService";
import useSpeechRecognition from "../hooks/useSpeechRecognition";
import { matchWakePhrase } from "./wakePhraseMatcher";

import styles from "./wakePopup.module.css";

/**
 * ==========================================
 * WakePopup
 * ------------------------------------------
 * The floating card shown in the dedicated wake popup BrowserWindow
 * (see electron/wake/wakeWindowManager.js) after "Hey Yuna" or
 * "Thangapila" is detected. NOT a panel inside ChatView - a completely
 * separate render tree (see main.jsx's `?popup=wake` branch), reusing
 * the app's existing authenticated pipeline rather than a second one:
 * same SocketService class, same "yuna:message:send" entry point, same
 * "yuna:image:*" events ChatMessageBubble already renders - just a
 * smaller, focused surface for it.
 *
 * Auth: JWT storage (localStorage/sessionStorage) is shared across
 * BrowserWindows loading the same origin (see authStore.js's own
 * doc comment on token storage) - this window reads the same token the
 * main window already signed in with, rather than needing its own
 * login or any new IPC-based auth bridge.
 * ==========================================
 */
export default function WakePopup() {
    const restoreSession = useAuthStore((state) => state.restoreSession);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const initialized = useAuthStore((state) => state.initialized);

    const [input, setInput] = useState("");
    const [status, setStatus] = useState("idle"); // idle | sending | error
    const [reply, setReply] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [image, setImage] = useState(null); // { status: loading|done|error, prompt, data, mimeType, error }
    const [error, setError] = useState(null);
    const lastPromptRef = useRef("");
    const inputRef = useRef(null);

    const { supported: micSupported, listening, start: startMic, stop: stopMic } = useSpeechRecognition();

    useEffect(() => {
        restoreSession();
    }, [restoreSession]);

    // Delivers the payload the wake listener captured (phraseId +
    // whatever it transcribed around the wake phrase) once this window
    // signals it's actually ready to receive it - see
    // wakeWindowManager.deliverPendingPayload().
    useEffect(() => {
        ElectronService.onWakePopupInit((payload) => {
            // The popup window is reused across triggers (hidden, not
            // reloaded/destroyed - see wakeWindowManager.js), so without
            // this the previous turn's reply/image/error would still be
            // showing the next time "Hey Yuna" opens it.
            setReply("");
            setImage(null);
            setError(null);
            setStatus("idle");

            if (!payload) return;
            const match = matchWakePhrase(payload.transcript || "");
            let leftover = payload.transcript || "";
            if (match) {
                leftover = leftover.replace(match.matchedVariant, "").trim();
            }
            setInput(leftover);
            inputRef.current?.focus({ cursor: "end" });
        });
        ElectronService.signalWakePopupReady();
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return undefined;

        const onStreamStart = () => { setStreaming(true); setReply(""); };
        const onStreamChunk = (chunk) => setReply((prev) => prev + (typeof chunk === "string" ? chunk : chunk?.text || ""));
        const onStreamEnd = () => setStreaming(false);
        const onReply = (data) => {
            setStatus("idle");
            if (data && typeof data.text === "string") setReply(data.text);
        };
        const onError = (err) => {
            setStatus("error");
            setError((err && err.message) || "Something went wrong.");
        };
        const onImageStart = () => setImage({ status: "loading", prompt: lastPromptRef.current });
        const onImageResult = (data) => setImage({ status: "done", data: data.data, mimeType: data.mimeType, prompt: data.prompt });
        const onImageError = (data) => setImage({ status: "error", prompt: lastPromptRef.current, error: data?.message });

        SocketService.on("yuna:stream:start", onStreamStart);
        SocketService.on("yuna:stream:chunk", onStreamChunk);
        SocketService.on("yuna:stream:end", onStreamEnd);
        SocketService.on("yuna:message:reply", onReply);
        SocketService.on("yuna:message:error", onError);
        SocketService.on("yuna:image:start", onImageStart);
        SocketService.on("yuna:image:result", onImageResult);
        SocketService.on("yuna:image:error", onImageError);

        return () => {
            SocketService.off("yuna:stream:start", onStreamStart);
            SocketService.off("yuna:stream:chunk", onStreamChunk);
            SocketService.off("yuna:stream:end", onStreamEnd);
            SocketService.off("yuna:message:reply", onReply);
            SocketService.off("yuna:message:error", onError);
            SocketService.off("yuna:image:start", onImageStart);
            SocketService.off("yuna:image:result", onImageResult);
            SocketService.off("yuna:image:error", onImageError);
        };
    }, [isAuthenticated]);

    function close() {
        stopMic();
        ElectronService.hideWakePopup();
    }

    function send(overrideText) {
        const text = (overrideText ?? input).trim();
        if (!text || status === "sending" || !SocketService.isConnected()) return;

        lastPromptRef.current = text;
        setStatus("sending");
        setError(null);
        setReply("");
        setImage(null);
        SocketService.emit("yuna:message:send", { id: crypto.randomUUID(), text });
        setInput("");
    }

    function retry() {
        if (lastPromptRef.current) send(lastPromptRef.current);
    }

    function toggleMic() {
        if (listening) {
            stopMic();
            return;
        }
        startMic("en-US", (finalTranscript) => {
            setInput(finalTranscript);
            send(finalTranscript);
        });
    }

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <span className={styles.title}>🌸 Yuna</span>
                <button className={styles.closeButton} onClick={close} aria-label="Close">
                    <CloseOutlined />
                </button>
            </div>

            <div className={styles.body}>
                {!initialized ? (
                    <div className={styles.hint}>Connecting…</div>
                ) : !isAuthenticated ? (
                    <div className={styles.hint}>Sign in on the main Yuna window first.</div>
                ) : (
                    <>
                        {!reply && !image && status === "idle" && !streaming && (
                            <div className={styles.hint}>Hey! What can I help with?</div>
                        )}

                        {(reply || streaming) && (
                            <div className={styles.reply}>{reply || "…"}</div>
                        )}

                        {image && image.status === "loading" && (
                            <div className={styles.imageCard}>
                                <PictureOutlined className={styles.imageIcon} spin={false} />
                                <span>Creating your image…</span>
                            </div>
                        )}
                        {image && image.status === "done" && (
                            <img
                                className={styles.imageResult}
                                src={`data:${image.mimeType};base64,${image.data}`}
                                alt={image.prompt || "Generated"}
                            />
                        )}
                        {image && image.status === "error" && (
                            <div className={styles.errorRow}>
                                <span>{image.error || "Image generation failed."}</span>
                                <Button size="small" icon={<ReloadOutlined />} onClick={retry}>Retry</Button>
                            </div>
                        )}

                        {status === "error" && (
                            <div className={styles.errorRow}>
                                <span>{error}</span>
                                <Button size="small" icon={<ReloadOutlined />} onClick={retry}>Retry</Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className={styles.composer}>
                <Input
                    ref={inputRef}
                    className={styles.input}
                    placeholder="Ask Yuna…"
                    value={input}
                    disabled={!isAuthenticated || status === "sending"}
                    onChange={(e) => setInput(e.target.value)}
                    onPressEnter={() => send()}
                />
                <Tooltip title={micSupported ? "Speak" : "Microphone unavailable"}>
                    <Button
                        className={listening ? styles.micActive : undefined}
                        icon={<AudioOutlined />}
                        disabled={!micSupported || !isAuthenticated}
                        onClick={toggleMic}
                    />
                </Tooltip>
                <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={status === "sending"}
                    disabled={!isAuthenticated || !input.trim()}
                    onClick={() => send()}
                />
            </div>
        </div>
    );
}
