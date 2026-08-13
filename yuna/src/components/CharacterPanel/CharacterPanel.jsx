import React from "react";
import { motion } from "framer-motion";
import Live2DCanvas from "../../live2d/Live2DCanvas";
import styles from "./characterPanel.module.css";
import useCharacterState from "../../hooks/useCharacterState";
import useEmotionState from "../../hooks/useEmotionState";
import useVoice from "../../hooks/useVoice";

export default function CharacterPanel() {
    const { speaking } = useVoice();
    const { isThinking, isTalking } = useCharacterState();

    // Full 9-axis cognitive emotion state
    const {
        energy = 0.5,
        joy = 0.5,
        primary = "neutral",
        animProps = {},
    } = useEmotionState();

    // Dynamic glow opacity & scale from emotion axes
    const glowOpacity = animProps.glowOpacity || (0.2 + joy * 0.4 + energy * 0.2);
    const breathOpacity = isTalking || speaking
        ? Math.min(0.45, 0.2 + energy * 0.25)
        : Math.min(0.25, 0.1 + energy * 0.15);

    // Primary emotion label mapping
    const emotionLabels = {
        happy: "✨ Happy",
        excited: "⚡ Excited",
        curious: "🔍 Curious",
        thinking: "💭 Thinking",
        sad: "🌧️ Melancholic",
        anxious: "💫 Nervous",
        angry: "🔥 Fired Up",
        shy: "🌸 Flustered",
        surprised: "❗ Surprised",
        neutral: "🍃 Calm",
    };

    const currentLabel = isThinking
        ? "💭 Thinking..."
        : isTalking || speaking
        ? "🎙️ Speaking"
        : emotionLabels[primary] || "🍃 Calm";

    return (
        <div className={styles.wrap}>
            <div className={styles.cityBg} />

            <div className={styles.characterWrap}>
                {/* Background ambient glow ring */}
                <motion.div
                    className={styles.orbGlow}
                    animate={{
                        opacity: glowOpacity,
                        scale: [0.95, 1.05, 0.95],
                    }}
                    transition={{
                        duration: 3.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* Subtle breath ring aura */}
                <motion.div
                    className={styles.breath}
                    animate={{
                        opacity: breathOpacity,
                        scale: [0.97, 1.03, 0.97],
                    }}
                    transition={{
                        duration: 4.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* Upgraded Live2D Canvas with 13 subsystems */}
                <Live2DCanvas />
            </div>

            {/* Futuristic floating emotion indicator */}
            <div
                style={{
                    position: "absolute",
                    top: "18px",
                    left: "18px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 14px",
                    borderRadius: "999px",
                    background: "rgba(18, 10, 36, 0.65)",
                    border: "1px solid rgba(168, 85, 247, 0.25)",
                    backdropFilter: "blur(12px)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                    fontSize: "12px",
                    fontWeight: "500",
                    color: "rgba(230, 220, 255, 0.9)",
                    letterSpacing: "0.02em",
                    pointerEvents: "none",
                    zIndex: 10,
                }}
            >
                <div
                    style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: isThinking
                            ? "#a855f7"
                            : isTalking || speaking
                            ? "#3b82f6"
                            : "#10b981",
                        boxShadow: `0 0 10px ${
                            isThinking
                                ? "#a855f7"
                                : isTalking || speaking
                                ? "#3b82f6"
                                : "#10b981"
                        }`,
                    }}
                />
                <span>{currentLabel}</span>
            </div>

            <div className={styles.idleHints}>
                <div className={styles.hintLine} />
                <div className={styles.hintLine} />
                <div className={styles.hintLine} />
            </div>
        </div>
    );
}