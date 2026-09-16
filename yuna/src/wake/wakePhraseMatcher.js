/**
 * ==========================================
 * wakePhraseMatcher
 * ------------------------------------------
 * Zero DOM/Electron/React dependencies on purpose - this is the part of
 * the wake system that's actually deterministic and testable, so it's
 * kept separate from WakeListener.jsx (which just feeds it live
 * SpeechRecognition transcripts) and covered by real unit tests
 * (wakePhraseMatcher.test.js) run with plain `node --test`.
 *
 * HONESTY NOTE ON "THANGAPILA": there is no dedicated acoustic
 * wake-word model here - this matches against Chromium's own
 * general-purpose speech-to-text transcript (see WakeListener.jsx),
 * which is tuned for real words/phrases, not an invented phrase in a
 * language it isn't primarily modeling. The variant list below is a
 * best-effort set of plausible mis-transcriptions, not a guarantee.
 * A true low-power/offline wake-word engine (e.g. Picovoice Porcupine)
 * would need its own trained model for this exact phrase - see the
 * implementation report for what that would require.
 * ==========================================
 */

export const WAKE_PHRASES = [
    {
        id: "hey-yuna",
        label: "Hey Yuna",
        variants: ["hey yuna", "hey yoona", "hey una", "a yuna", "hi yuna"]
    },
    {
        id: "thangapila",
        label: "Thangapila",
        variants: [
            "thangapila", "thanga pila", "thangapilla", "thanga pilla",
            "thankapila", "thanga pillai", "thangapillai"
        ]
    }
];

/**
 * Lowercases, strips diacritics/punctuation, and collapses whitespace -
 * makes the includes() check below resilient to "Hey, Yuna!" vs
 * "hey yuna" vs stray capitalization from the recognizer.
 */
export function normalize(text) {
    return (text || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "") // combining diacritical marks
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Returns { id, label, matchedVariant, normalizedTranscript } for the
 * first configured phrase found inside `transcript`, or null if none
 * matched. Checked as a substring (not an exact match) since a real
 * recognizer transcript is usually a full sentence ("hey yuna what's
 * the weather"), not just the wake phrase alone.
 */
export function matchWakePhrase(transcript) {
    const normalized = normalize(transcript);
    if (!normalized) return null;

    for (const phrase of WAKE_PHRASES) {
        for (const variant of phrase.variants) {
            if (normalized.includes(variant)) {
                return {
                    id: phrase.id,
                    label: phrase.label,
                    matchedVariant: variant,
                    normalizedTranscript: normalized
                };
            }
        }
    }
    return null;
}

/**
 * Prevents "Hey Yuna" said three times in a row (or one long utterance
 * containing the phrase twice, across separate recognizer results) from
 * opening three popups - see wakeWindowManager.js's own idempotent
 * showPopup() for the second, independent guard against duplicate
 * windows on the Electron side.
 */
export class WakeCooldown {
    constructor(cooldownMs = 3000) {
        this.cooldownMs = cooldownMs;
        // -Infinity, not 0: a `now` passed in as a small test timestamp
        // (or any timestamp before the cooldown window from epoch 0)
        // must never look like it's "still within cooldown" of a
        // trigger that never actually happened.
        this._lastTriggerAt = -Infinity;
    }

    /** Returns true (and starts the cooldown) if a trigger is allowed right now. */
    tryTrigger(now = Date.now()) {
        if (now - this._lastTriggerAt < this.cooldownMs) return false;
        this._lastTriggerAt = now;
        return true;
    }

    reset() {
        this._lastTriggerAt = -Infinity;
    }
}
