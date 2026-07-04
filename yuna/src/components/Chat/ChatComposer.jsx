import React, { useState } from "react";
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

    return (

        <div className={styles.composer}>

            <motion.button

                className={`${styles.micButton} ${recording ? styles.recording : ""}`}

                whileHover={{ scale: 1.03 }}

                whileTap={{ scale: 0.97 }}

                onClick={toggleMic}

            >

                🎤

            </motion.button>

            <textarea

                className={styles.input}

                rows={1}

                value={input}

                disabled={!connected}

                onKeyDown={onKeyDown}

                onChange={e => setInput(e.target.value)}

                placeholder={

                    thinking

                        ? "Yuna is thinking..."

                        : typing

                            ? "Yuna is replying..."

                            : "Say 'Hey Yuna' or type a message..."

                }

            />

            <motion.button

                className={styles.sendButton}

                whileHover={{ scale: 1.03 }}

                whileTap={{ scale: 0.97 }}

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

            </motion.button>

        </div>

    );

}