import React, { useEffect, useRef } from "react";
import Live2DManager from "./Live2DManager";
import useEmotionState from "../hooks/useEmotionState";
import useChatStore from "../store/chatStore";

export default function Live2DCanvas({ className = "", style = {} }) {
    const containerRef = useRef(null);

    // Reactive states
    const emotion = useEmotionState();
    const typing = useChatStore((state) => state.typing);
    const thinking = useChatStore((state) => state.thinking);

    // 1. Initialize canvas & model in container element
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        Live2DManager.initialize(container);

        // ResizeObserver for responsive canvas resizing
        const resizeObserver = new ResizeObserver(() => {
            Live2DManager.resize();
        });

        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
            Live2DManager.destroy();
        };
    }, []);

    // 2. Sync Emotion Engine state
    useEffect(() => {
        if (emotion) {
            Live2DManager.setEmotionState(emotion);
        }
    }, [emotion]);

    // 3. Sync Speaking / Typing state
    useEffect(() => {
        Live2DManager.setSpeaking(Boolean(typing));
    }, [typing]);

    // 4. Sync Thinking state
    useEffect(() => {
        Live2DManager.setThinking(Boolean(thinking));
    }, [thinking]);

    // 5. Global pointer tracking so character tracks mouse across the entire window
    useEffect(() => {
        const handleGlobalMouseMove = (e) => {
            Live2DManager.handlePointerMove(e.clientX, e.clientY);
        };

        const handleGlobalMouseLeave = () => {
            Live2DManager.handlePointerLeave();
        };

        window.addEventListener("pointermove", handleGlobalMouseMove, { passive: true });
        document.addEventListener("mouseleave", handleGlobalMouseLeave);

        return () => {
            window.removeEventListener("pointermove", handleGlobalMouseMove);
            document.removeEventListener("mouseleave", handleGlobalMouseLeave);
        };
    }, []);

    const handleClick = () => {
        Live2DManager.handleTap();
    };

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                cursor: "pointer",
                userSelect: "none",
                ...style,
            }}
            onClick={handleClick}
        />
    );
}