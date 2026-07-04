import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import ChatMessageBubble from "../../components/ChatMessageBubble/ChatMessageBubble";
import CharacterPanel from "../../components/CharacterPanel/CharacterPanel";

import DesktopTitleBar from "../../components/Desktop/DesktopTitleBar";
import "../../components/Desktop/DesktopTitleBar.css";

import styles from "./chatView.module.css";

import SocketService from "../../services/socketService";
import useChatStore from "../../store/chatStore";

import MicrophoneService from "../../services/microphoneService";

export default function ChatView() {

  const [recording, setRecording] = useState(false);

  const messages = useChatStore(state => state.messages);

  const typing = useChatStore(state => state.typing);

  const thinking = useChatStore(state => state.thinking);

  const connected = useChatStore(state => state.connected);

  const streamingText = useChatStore(state => state.streamingText);

  const addMessage = useChatStore(state => state.addMessage);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {

    messagesEndRef.current?.scrollIntoView({

      behavior: "smooth",

      block: "end"

    });

  }, [

    messages,

    streamingText,

    typing

  ]);

  function onSend() {

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className={styles.appRoot}>
      <DesktopTitleBar />
      <div className={styles.topHeader}>
        <div className={styles.avatarWrap}>
          <div className={styles.avatarOrb} />
          <div className={styles.avatarText}>Yuna</div>
        </div>

        <div className={styles.statusWrap}>
          <span className={styles.statusLabel}>Status</span>

          <span className={styles.statusValue}>
            {connected ? "🟢 Connected" : "🔴 Disconnected"}
          </span>
        </div>

        <div className={styles.micIndicator} aria-live="polite">
          <span className={styles.micDot} />
          <span className={styles.micText}>{thinking ? "Thinking..." : "Mic ready"}</span>
        </div>
      </div>

      <div className={styles.mainSplit}>
        <CharacterPanel

          isSpeaking={typing}

          thinking={thinking}

        />
        <div className={styles.chatPanel}>
          <div className={styles.chatScroll}>
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChatMessageBubble message={m} />
                </motion.div>
              ))}
            </AnimatePresence>

            {thinking && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles.thinkingRow}
              >
                <div className={styles.thinkingDots}>
                  <span />
                  <span />
                  <span />
                </div>
              </motion.div>
            )}
            {typing && streamingText && (

              <motion.div

                initial={{ opacity: 0 }}

                animate={{ opacity: 1 }}

              >

                <ChatMessageBubble

                  message={{

                    role: "assistant",

                    text: streamingText

                  }}

                />

              </motion.div>

            )}

            <div ref={messagesEndRef} />
          </div>

          <div className={styles.composer}>
            <motion.button
              type="button"
              className={styles.micButton}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              animate={{ boxShadow: typing ? '0 0 0 1px rgba(168,85,247,0.35), 0 0 28px rgba(168,85,247,0.5)' : undefined }}
              onClick={async () => {

                if (!recording) {

                  await MicrophoneService.start();

                  setRecording(true);

                }

                else {

                  const audioBlob =

                    await MicrophoneService.stop();

                  setRecording(false);

                  console.log(audioBlob);

                }

              }}
            >
              <span className={styles.micIcon} />
              <span className={styles.micGlow} />
            </motion.button>

            <div className={styles.inputWrap}>
              <textarea
                className={styles.textInput}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={

                  thinking

                    ? "Yuna is thinking..."

                    : typing

                      ? "Yuna is replying..."

                      : "Say 'Hey Yuna' or type a message..."

                }
                rows={1}
                disabled={!connected}
              />
            </div>

            <motion.button
              type="button"
              className={styles.sendButton}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSend}
              disabled={

                !input.trim()

                ||

                typing

                ||

                thinking

                ||

                !connected

              }
            >
              <span className={styles.sendLabel}>Send</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

