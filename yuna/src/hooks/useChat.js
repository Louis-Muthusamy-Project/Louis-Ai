import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../services/socket";
import { useEmotionStore } from "../store/emotionStore";
import { speakText } from "../voice/voiceService";

function createMessage(role, text, extra = {}) {
    return {
        id: extra.id || `${Date.now()}-${Math.random()}`,
        role,
        text,
        createdAt: extra.createdAt || new Date().toISOString(),
        ...extra,
    };
}

export function useChat() {
    const setEmotion = useEmotionStore((state) => state.setEmotion);
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState(
        socket.connected ? "connected" : "connecting"
    );
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        const handleConnect = () => {
            if (mountedRef.current) setConnectionStatus("connected");
        };

        const handleDisconnect = () => {
            if (mountedRef.current) {
                setConnectionStatus("disconnected");
                setIsTyping(false);
            }
        };

        const handleReconnectAttempt = () => {
            if (mountedRef.current) setConnectionStatus("reconnecting");
        };

        const handleConnectError = () => {
            if (mountedRef.current) setConnectionStatus("error");
        };

        const handleTyping = (payload) => {
            if (mountedRef.current) setIsTyping(Boolean(payload?.status));
        };

        const handleReply = (payload) => {
            if (!mountedRef.current) return;

            setIsTyping(false);
            setMessages((previous) => [
                ...previous,
                createMessage("assistant", payload?.message || "I lost my words for a second."),
            ]);

            if (payload?.emotion) {
                setEmotion(payload.emotion, payload.intensity ?? 50);
            }

            if (payload?.voice?.enabled !== false && payload?.message) {
                const utterance = speakText(payload.message);

                if (utterance) {
                    window.dispatchEvent(
                        new CustomEvent("yuna_speaking", {
                            detail: { speaking: true },
                        })
                    );

                    utterance.onend = () => {
                        window.dispatchEvent(
                            new CustomEvent("yuna_speaking", {
                                detail: { speaking: false },
                            })
                        );
                    };

                    utterance.onerror = () => {
                        window.dispatchEvent(
                            new CustomEvent("yuna_speaking", {
                                detail: { speaking: false },
                            })
                        );
                    };
                }
            }
        };

        const handleError = (payload) => {
            if (!mountedRef.current) return;

            setIsTyping(false);
            setMessages((previous) => [
                ...previous,
                createMessage("assistant", payload?.message || "Yuna encountered an error.", {
                    mode: "error",
                }),
            ]);
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.io.on("reconnect_attempt", handleReconnectAttempt);
        socket.on("connect_error", handleConnectError);
        socket.on("yuna_typing", handleTyping);
        socket.on("yuna_reply", handleReply);
        socket.on("yuna_error", handleError);

        if (!socket.connected) {
            socket.connect();
        }

        return () => {
            mountedRef.current = false;
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.io.off("reconnect_attempt", handleReconnectAttempt);
            socket.off("connect_error", handleConnectError);
            socket.off("yuna_typing", handleTyping);
            socket.off("yuna_reply", handleReply);
            socket.off("yuna_error", handleError);
            socket.disconnect();
        };
    }, [setEmotion]);

    const sendMessage = useCallback((message) => {
        const text = typeof message === "string" ? message.trim() : "";

        if (!text || !socket.connected) {
            return false;
        }

        setMessages((previous) => [...previous, createMessage("user", text)]);
        socket.emit("user_message", { message: text });
        return true;
    }, []);

    return {
        messages,
        sendMessage,
        isTyping,
        connectionStatus,
    };
}
