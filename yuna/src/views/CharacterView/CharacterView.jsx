import React from "react";

import CharacterPanel from "../../components/CharacterPanel/CharacterPanel";

import styles from "./characterView.module.css";

/**
 * A dedicated, full-screen view of the same Live2D character shown
 * alongside Chat - reuses CharacterPanel directly (not a
 * reimplementation). CharacterPanel takes no props; it derives its
 * speaking/thinking/emotion state from its own hooks
 * (useVoice/useCharacterState/EmotionEngine), so it reacts to the same
 * live conversation state regardless of which tab it's rendered in.
 *
 * LIMITATION (documented, not hidden): this is a real reuse of the
 * existing character component, not a standalone voice-to-voice
 * interaction mode - no dedicated microphone/wake-word/voice-only
 * backend exists in this codebase to power a distinct "talk to Yuna by
 * voice, no text" experience. That was never built in any prior session
 * of this project; this tab surfaces what genuinely exists today rather
 * than fabricating a voice-mode UI with nothing behind it.
 */
export default function CharacterView() {
    return (
        <div className={styles.root}>
            <CharacterPanel />
        </div>
    );
}
