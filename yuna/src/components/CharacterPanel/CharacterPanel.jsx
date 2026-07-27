import React from "react";
import { motion } from "framer-motion";
import Live2DCanvas from "../../live2d/Live2DCanvas";

import styles from "./characterPanel.module.css";
import useCharacterState from "../../hooks/useCharacterState";
import useEmotionState from "../../hooks/useEmotionState";
import useVoice from "../../hooks/useVoice";

export default function CharacterPanel() {
  const { speaking } = useVoice();

  const {
    isIdle,
    isListening,
    isThinking,
    isTalking,
  } = useCharacterState();

  // Full cognitive emotion state — drives continuous animation
  const {
    energy,
    joy,
    stress,
    curiosity,
    primary,
    animProps,
  } = useEmotionState();

  // ── Derive continuous animation parameters from emotion axes ──────────────

  // Character scale: excited/talking → slightly bigger
  const characterScale = isTalking || speaking
    ? animProps.characterScale + 0.01
    : isThinking
      ? 1.02
      : isListening
        ? 1.01
        : animProps.characterScale;

  // Vertical bob: idle + joy drives it
  const yAnimation = isIdle
    ? [0, -(animProps.bobAmplitude), 0]
    : 0;

  // Rotation: happy/excited wiggle; stress twitch is smaller
  const rotateAnimation = primary === "excited"
    ? [0, animProps.rotateAmplitude, -animProps.rotateAmplitude, 0]
    : joy > 0.65
      ? [0, animProps.rotateAmplitude, -animProps.rotateAmplitude, 0]
      : stress > 0.55
        ? [0, 0.8, -0.8, 0]
        : 0;

  // Breath ring opacity and scale driven by energy + speaking
  const breathOpacity = isTalking || speaking
    ? Math.min(0.6, 0.3 + energy * 0.3)
    : Math.min(0.35, 0.15 + energy * 0.2);

  const breathScale = isTalking || speaking
    ? animProps.breathScale + 0.1
    : animProps.breathScale;

  // Glow intensity driven by energy + joy
  const glowOpacity = animProps.glowOpacity;

  // Animation duration: excited = faster, calm = slower
  const animDuration = primary === "excited" ? 1.2
    : primary === "anxious" ? 1.5
    : energy > 0.7 ? 1.8
    : 2.5;

  const shouldRepeat = isIdle || joy > 0.55 || primary === "excited";

  return (
    <div className={styles.wrap}>

      <div className={styles.cityBg} />

      <motion.div
        className={styles.characterWrap}
        animate={{
          scale: characterScale,
          y: yAnimation,
          rotate: rotateAnimation,
        }}
        transition={{
          duration: animDuration,
          repeat: shouldRepeat ? Infinity : 0,
          ease: "easeInOut"
        }}
      >

        {/* Glow ring — intensity driven by energy + joy */}
        <motion.div
          className={styles.orbGlow}
          animate={{ opacity: glowOpacity }}
          transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
        />

        <Live2DCanvas />

        {/* Breath ring — driven by energy and speaking state */}
        <motion.div
          className={styles.breath}
          animate={{
            opacity: breathOpacity,
            scale: breathScale,
          }}
          transition={{
            repeat: Infinity,
            duration: animDuration * 0.9,
            ease: "easeInOut"
          }}
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