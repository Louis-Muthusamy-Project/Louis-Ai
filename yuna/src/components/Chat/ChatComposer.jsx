import React, { useState } from "react";
import { Button, Input, Tooltip } from "antd";
import { AudioOutlined, SendOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";

import SocketService from "../../services/socketService";
import MicrophoneService from "../../services/microphoneService";

import useChatStore from "../../store/chatStore";

import styles from "./chatComposer.module.css";

export default function ChatComposer() {

    const [input, setInput] = useState("");
    const [recording, setRecording] = useState(false);

    const addMessage = useChatStore(state => state.addMessage);
    const connected = useChatStore(state => state.connected);
    const typing = useChatStore(state => state.typing);
    const thinking = useChatStore(state => state.thinking);

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
                <Button
                    className={styles.sendButton}
                    type="primary"
                    icon={<SendOutlined />}
                    disabled={
                        !input.trim()
                        ||
                        !connected
                        ||
                        typing
                        ||
                        thinking
                    }
                    onClick={send}
                >
                    Send
                </Button>
            </motion.div>

        </div>

    );

}