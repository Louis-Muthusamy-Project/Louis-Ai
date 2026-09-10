import React from "react";

import CharacterPanel from "../../components/CharacterPanel/CharacterPanel";
import VoiceControls from "../../components/Character/VoiceControls";

import styles from "./characterView.module.css";

/**
 * A dedicated, full-screen view of the same Live2D character shown
 * alongside Chat - reuses CharacterPanel directly (not a
 * reimplementation). CharacterPanel takes no props; it derives its
 * speaking/thinking/emotion state from its own hooks
 * (useVoice/useCharacterState/EmotionEngine), so it reacts to the same
 * live conversation state regardless of which tab it's rendered in.
 *
 * VoiceControls adds the actual voice-to-voice input leg - see that
 * component for how it reuses the existing text-chat pipeline (AI
 * response, TTS, Live2D lip-sync) rather than reimplementing any of it.
 */
export default function CharacterView() {
    return (
        <div className={styles.root}>
            <CharacterPanel />
            <VoiceControls />
        </div>
    );
}
