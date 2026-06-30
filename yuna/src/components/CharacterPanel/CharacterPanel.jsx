import React from 'react';
import { motion } from 'framer-motion';
import styles from './characterPanel.module.css';

export default function CharacterPanel({ isSpeaking }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.cityBg} />
      <motion.div
        className={styles.characterWrap}
        animate={{
  scale: isSpeaking ? 1.01 : 1
}}
        transition={{ duration: 0.25 }}
      >
        <div className={styles.orbGlow} />

        {/* Minimal anime-inspired face (SVG) */}
        <svg
          className={styles.faceSvg}
          viewBox="0 0 320 320"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Yuna character"
        >
          <defs>
            <linearGradient id="hair" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#a855f7" stopOpacity="0.95" />
              <stop offset="1" stopColor="#60a5fa" stopOpacity="0.65" />
            </linearGradient>
            <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f4d2ff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#b7f0ff" stopOpacity="0.35" />
            </linearGradient>
          </defs>

          {/* Hair */}
          <path
            d="M60 120C70 60 120 30 160 30C200 30 250 60 260 120C245 110 230 105 214 108C190 112 178 96 160 96C142 96 130 112 106 108C90 105 75 110 60 120Z"
            fill="url(#hair)"
            opacity="0.95"
          />

          {/* Face */}
          <path
            d="M92 138C92 95 120 70 160 70C200 70 228 95 228 138C228 210 196 256 160 256C124 256 92 210 92 138Z"
            fill="url(#skin)"
            opacity="0.9"
          />

          {/* Eyes */}
          <g opacity="0.95">
            <ellipse cx="125" cy="145" rx="28" ry="18" fill="#0b0620" />
            <ellipse cx="195" cy="145" rx="28" ry="18" fill="#0b0620" />

            <motion.g
              animate={{ y: isSpeaking ? -2 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <circle cx="132" cy="145" r="8" fill="#a855f7" />
              <circle cx="202" cy="145" r="8" fill="#60a5fa" />
            </motion.g>
          </g>

          {/* Mouth */}
          <path
            d="M142 198C150 206 170 206 178 198"
            fill="none"
            stroke="#0b0620"
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.75"
          />

          {/* Cheek blush */}
          <ellipse cx="110" cy="175" rx="22" ry="12" fill="#a855f7" opacity="0.18" />
          <ellipse cx="210" cy="175" rx="22" ry="12" fill="#60a5fa" opacity="0.14" />
        </svg>

        <motion.div
          className={styles.breath}
          animate={{ opacity: isSpeaking ? 0.35 : 0.2 }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>

      <div className={styles.idleHints}>
        <div className={styles.hintLine} />
        <div className={styles.hintLine} />
        <div className={styles.hintLine} />
      </div>
    </div>
  );
}

