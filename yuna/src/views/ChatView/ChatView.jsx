import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatMessageBubble from '../../components/ChatMessageBubble/ChatMessageBubble';
import CharacterPanel from '../../components/CharacterPanel/CharacterPanel';
import styles from './chatView.module.css';
import { useChat } from '../../hooks/useChat';

export default function ChatView() {
  const { messages, sendMessage, isTyping, connectionStatus } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  function onSend() {
    const text = input.trim();
    if (!text || isTyping) return;

    if (sendMessage(text)) {
      setInput('');
    }
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
            {connectionStatus === 'connected' ? 'Listening' : connectionStatus}
          </span>
        </div>

        <div className={styles.micIndicator} aria-live="polite">
          <span className={styles.micDot} />
          <span className={styles.micText}>{isTyping ? 'Thinking...' : 'Mic ready'}</span>
        </div>
      </div>

      <div className={styles.mainSplit}>
        <CharacterPanel isSpeaking={isTyping} />

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

            {isTyping && (
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
              animate={{ boxShadow: isTyping ? '0 0 0 1px rgba(168,85,247,0.35), 0 0 28px rgba(168,85,247,0.5)' : undefined }}
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
                disabled={connectionStatus !== 'connected'}
              />
            </div>

            <motion.button
              type="button"
              className={styles.sendButton}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSend}
              disabled={!input.trim() || isTyping || connectionStatus !== 'connected'}
            >
              <span className={styles.sendLabel}>Send</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

