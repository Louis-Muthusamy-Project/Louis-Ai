import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import ChatMessageBubble from '../../components/ChatMessageBubble/ChatMessageBubble';
import CharacterPanel from '../../components/CharacterPanel/CharacterPanel';
import styles from './chatView.module.css';
import { socket } from "../../services/socket";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

export default function ChatView() {
  socket.on("connect", () => {
    console.log("Connected", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error(err);
  });

  const [connectionReady, setConnectionReady] = useState(false);
  const [messages, setMessages] = useState([]);

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.on('yuna:connection:ready', () => {
      setConnectionReady(true);
    });

    socket.on('yuna:message:reply', (payload) => {
      setIsSending(false);
      setMessages((prev) => [...prev, payload]);
    });

    socket.on('yuna:message:error', (payload) => {
      setIsSending(false);
      setMessages((prev) => [
        ...prev,
        {
          id: payload?.createdAt || `${Date.now()}`,
          role: 'assistant',
          text: payload?.message || 'Yuna encountered an error.',
          createdAt: payload?.createdAt || new Date().toISOString(),
          mode: 'error'
        }
      ]);
    });

    return () => {
      socket.off("yuna:connection:ready");
      socket.off("yuna:message:reply");
      socket.off("yuna:message:error");
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  function onSend() {
    const text = input.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        role: 'user',
        text,
        createdAt: new Date().toISOString(),
        mode: 'user'
      }
    ]);

    setInput('');

    socket.emit('yuna:message:send', { text, id: `${Date.now()}-${Math.random()}` });
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className={styles.appRoot}>
      <div className={styles.topHeader}>
        <div className={styles.avatarWrap}>
          <div className={styles.avatarOrb} />
          <div className={styles.avatarText}>Yuna</div>
        </div>

        <div className={styles.statusWrap}>
          <span className={styles.statusLabel}>Status</span>
          <span className={styles.statusValue}>
            {connectionReady ? 'Listening (Echo mode)' : 'Connecting...'}
          </span>
        </div>

        <div className={styles.micIndicator} aria-live="polite">
          <span className={styles.micDot} />
          <span className={styles.micText}>{isSending ? 'Thinking...' : 'Mic ready'}</span>
        </div>
      </div>

      <div className={styles.mainSplit}>
        <CharacterPanel isSpeaking={isSending} />

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

            {isSending && (
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

            <div ref={messagesEndRef} />
          </div>

          <div className={styles.composer}>
            <motion.button
              type="button"
              className={styles.micButton}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              animate={{ boxShadow: isSending ? '0 0 0 1px rgba(168,85,247,0.35), 0 0 28px rgba(168,85,247,0.5)' : undefined }}
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
                placeholder='Say “Hey Yuna” or type a message...'
                rows={1}
              />
            </div>

            <motion.button
              type="button"
              className={styles.sendButton}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSend}
              disabled={!input.trim() || isSending}
            >
              <span className={styles.sendLabel}>Send</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

