import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

import ChatMessageBubble from "../ChatMessageBubble/ChatMessageBubble";

import useChatStore from "../../store/chatStore";

import styles from "./chatMessages.module.css";

export default function ChatMessages() {

    const messages = useChatStore(

        state => state.messages

    );

    const typing = useChatStore(

        state => state.typing

    );

    const thinking = useChatStore(

        state => state.thinking

    );

    const streamingText = useChatStore(

        state => state.streamingText

    );

    const bottomRef = useRef(null);

    useEffect(() => {

        bottomRef.current?.scrollIntoView({

            behavior: "smooth",

            block: "end"

        });

    }, [

        messages,

        streamingText,

        typing,

        thinking

    ]);

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

            {

                thinking && (

                    <motion.div

                        className={styles.thinking}

                        initial={{

                            opacity: 0

                        }}

                        animate={{

                            opacity: 1

                        }}

                    >

                        <span />

                        <span />

                        <span />

                    </motion.div>

                )

            }

            {

                typing

                &&

                streamingText

                &&

                (

                    <motion.div

                        initial={{

                            opacity: 0

                        }}

                        animate={{

                            opacity: 1

                        }}

                    >

                        <ChatMessageBubble

                            message={{

                                id: "stream",

                                role: "assistant",

                                text: streamingText

                            }}

                        />

                    </motion.div>

                )

            }

            <div ref={bottomRef} />

        </div>

    );

}