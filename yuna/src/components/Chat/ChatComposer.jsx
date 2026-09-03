import React, { useState } from "react";
import { Button, Input, Tooltip } from "antd";
import { AudioOutlined, SendOutlined, PictureOutlined, StopOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";

import SocketService from "../../services/socketService";
import MicrophoneService from "../../services/microphoneService";
import VoiceService from "../../services/voiceService";

import useChatStore from "../../store/chatStore";

import styles from "./chatComposer.module.css";

export default function ChatComposer() {

    const [input, setInput] = useState("");
    const [recording, setRecording] = useState(false);

    const addMessage = useChatStore(state => state.addMessage);
    const connected = useChatStore(state => state.connected);
    const typing = useChatStore(state => state.typing);
    const thinking = useChatStore(state => state.thinking);
    const setTyping = useChatStore(state => state.setTyping);
    const setThinking = useChatStore(state => state.setThinking);

    function stopGeneration() {

        SocketService.emit("yuna:stream:cancel");
        // Immediate local feedback rather than waiting for a server
        // round trip - the server also stops emitting further chunks/
        // voice for this stream once it processes the cancel.
        setTyping(false);
        setThinking(false);
        VoiceService.stop();

    }

    async function send() {

        const text = input.trim();

        if (!text) return;
        if (typing || thinking) return;
        if (!SocketService.isConnected()) return;

        const id = crypto.randomUUID();

        addMessage({

            id,
            role: "user",
            text,
            createdAt: new Date().toISOString()

        });

        SocketService.emit(

            "yuna:message:send",

            {
                id,
                text
            }

        );

        setInput("");

    }

    // Deliberately a separate, explicit action from send() rather than
    // auto-detecting "this looks like an image request" from free text -
    // natural-language routing to image generation isn't reliably wired
    // through the AI planning pipeline yet (see server-side audit notes),
    // so this calls the capability directly and is honest about being a
    // distinct action to the user.
    function generateImage() {

        const prompt = input.trim();

        if (!prompt) return;
        if (!SocketService.isConnected()) return;

        const id = crypto.randomUUID();

        addMessage({
            id,
            role: "assistant",
            text: "",
            image: { status: "loading", prompt },
            createdAt: new Date().toISOString()
        });

        SocketService.emit("IMAGE_GENERATE", { prompt, requestId: id });

        setInput("");

    }

    function onKeyDown(e) {

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }

    }

    async function toggleMic() {

        if (!recording) {
            await MicrophoneService.start();
            setRecording(true);
            return;
        }

        const audioBlob = await MicrophoneService.stop();
        setRecording(false);
        console.log(audioBlob);

    }

    const placeholder = thinking
        ? "Yuna is thinking..."
        : typing
            ? "Yuna is replying..."
            : "Say 'Hey Yuna' or type a message...";

    return (

        <div className={styles.composer}>

            <Tooltip title={recording ? "Stop recording" : "Start voice input"}>
                <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    style={{ display: "inline-flex" }}
                >
                    <Button
                        className={`${styles.micButton} ${recording ? styles.recording : ""}`}
                        shape="circle"
                        size="large"
                        icon={<AudioOutlined />}
                        aria-label={recording ? "Stop recording" : "Start voice input"}
                        onClick={toggleMic}
                    />
                </motion.div>
            </Tooltip>

            <Input.TextArea
                className={styles.input}
                autoSize={{ minRows: 1, maxRows: 6 }}
                value={input}
                disabled={!connected}
                onKeyDown={onKeyDown}
                onChange={e => setInput(e.target.value)}
                placeholder={placeholder}
                variant="borderless"
            />

            <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{ display: "inline-flex" }}
            >
                {(typing || thinking) ? (
                    <Button
                        className={styles.sendButton}
                        danger
                        icon={<StopOutlined />}
                        onClick={stopGeneration}
                    >
                        Stop
                    </Button>
                ) : (
                    <Button
                        className={styles.sendButton}
                        type="primary"
                        icon={<SendOutlined />}
                        disabled={!input.trim() || !connected}
                        onClick={send}
                    >
                        Send
                    </Button>
                )}
            </motion.div>

            <Tooltip title="Generate an image from this text">
                <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    style={{ display: "inline-flex" }}
                >
                    <Button
                        shape="circle"
                        size="large"
                        icon={<PictureOutlined />}
                        aria-label="Generate an image from this text"
                        disabled={!input.trim() || !connected}
                        onClick={generateImage}
                    />
                </motion.div>
            </Tooltip>

        </div>

    );

}