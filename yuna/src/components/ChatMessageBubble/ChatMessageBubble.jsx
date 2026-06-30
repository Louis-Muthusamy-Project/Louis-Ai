import React from 'react';
import { motion } from 'framer-motion';
import styles from './chatMessageBubble.module.css';

export default function ChatMessageBubble({ message }) {
  const role = message?.role || 'assistant';
  const text = message?.text || '';

  const isUser = role === 'user';

  return (
    <motion.div
      className={isUser ? styles.rowUser : styles.rowAssistant}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22 }}
    >
      <div className={isUser ? styles.bubbleUser : styles.bubbleAssistant}>
        <div className={styles.text}>{text}</div>
      </div>
    </motion.div>
  );
}

