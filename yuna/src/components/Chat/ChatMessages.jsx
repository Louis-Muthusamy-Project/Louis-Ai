import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Typography } from "antd";

import ChatMessageBubble from "../ChatMessageBubble/ChatMessageBubble";

import useChatStore from "../../store/chatStore";

import styles from "./chatMessages.module.css";

// Isolated so only this small subtree re-renders on every streaming chunk —
// previously ChatMessages itself subscribed to streamingText, which meant
// every chunk re-rendered the entire historical message list too.
function ThinkingIndicator() {

    const thinking = useChatStore(
        state => state.thinking
    );

    if (!thinking) return null;

    return (

        <motion.div
            className={styles.thinking}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >

            <span />
            <span />
            <span />

        </motion.div>

    );

}

// Isolated for the same reason — subscribes to streamingText/typing itself
// so streaming chunks only re-render this bubble, not the whole list. Also
// owns the per-chunk auto-scroll, since it's the component that actually
// re-renders on every chunk now.
function StreamingBubble({ bottomRef }) {

    const typing = useChatStore(
        state => state.typing
    );

    const streamingText = useChatStore(
        state => state.streamingText
    );

    useEffect(() => {

        if (typing && streamingText) {
            bottomRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "end"
            });
        }

    }, [streamingText, typing, bottomRef]);

    if (!typing || !streamingText) return null;

    return (

        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >

            <ChatMessageBubble
                message={{
                    id: "stream",
                    role: "assistant",
                    text: streamingText
                }}
            />

        </motion.div>

    );

}

export default function ChatMessages() {

    const messages = useChatStore(
        state => state.messages
    );

    const thinking = useChatStore(
        state => state.thinking
    );

    const typing = useChatStore(
        state => state.typing
    );

    const bottomRef = useRef(null);

    useEffect(() => {

        bottomRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end"
        });

    }, [messages, thinking, typing]);

    const isEmpty = messages.length === 0 && !thinking && !typing;

    if (isEmpty) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <div className={styles.emptyGlow} />
                    <Typography.Title level={3} style={{ color: "white", marginBottom: 4 }}>
                        Yuna
                    </Typography.Title>
                    <Typography.Text type="secondary">
                        Hi, I'm Yuna. Ask me anything, or start a conversation.
                    </Typography.Text>
                </div>
            </div>
        );
    }

    return (

        <div className={styles.container}>

            <AnimatePresence initial={false}>

                {
                    messages.map(message => (

                        <motion.div
                            key={message.id}
                            initial={{
                                opacity: 0,
                                y: 12
                            }}
                            animate={{
                                opacity: 1,
                                y: 0
                            }}
                            exit={{
                                opacity: 0,
                                y: 12
                            }}
                            transition={{
                                duration: 0.2
                            }}
                        >

                            <ChatMessageBubble
                                message={message}
                            />

                        </motion.div>

                    ))
                }

            </AnimatePresence>

            <ThinkingIndicator />

            <StreamingBubble bottomRef={bottomRef} />

            <div ref={bottomRef} />

        </div>

    );

}