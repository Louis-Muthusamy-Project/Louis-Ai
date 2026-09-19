/**
 * ==========================================
 * ttsTextSanitizer
 * ------------------------------------------
 * The ONLY place emoji-removal logic for TTS lives. Every TTS provider
 * must sanitize through sanitizeTtsText() before synthesis - this is
 * called once, at the single choke point where text leaves VoiceService
 * on its way to TTSService.synthesize() (see voiceService.js's speak()),
 * never inside EdgeTTSProvider or any other provider.
 *
 * This sanitizer NEVER touches the original chat/history text - callers
 * pass it a throwaway copy of the text specifically for speech, and the
 * stored/displayed message (with its emojis intact) is never mutated.
 *
 * Uses Unicode property escapes (Node/V8 native regex support, no
 * external emoji-list dependency to keep in sync) rather than a
 * hand-maintained codepoint table:
 *   - \p{Extended_Pictographic}  faces, hearts, animals, objects, symbols
 *   - \p{Regional_Indicator}     flag letter-pairs (e.g. US flag)
 *   - \p{Emoji_Modifier}         Fitzpatrick skin-tone modifiers
 *   - U+FE0E / U+FE0F            text/emoji variation selectors
 *   - U+200D                     zero-width joiner (family/profession/
 *                                 gender ZWJ sequences)
 *   - U+20E3                     combining enclosing keycap (the digit
 *                                 itself is a normal character and is
 *                                 deliberately left in place - only the
 *                                 keycap "wrapper" is emoji)
 *   - U+E0020-U+E007F            emoji tag characters (subdivision flag
 *                                 sequences, e.g. Scotland/Wales/England)
 *
 * Plain digits, #, and * are NEVER stripped on their own - only when
 * they're literally part of an emoji sequence (keycap combiner present)
 * does the emoji WRAPPER get removed, never the underlying character.
 *
 * After emoji removal, any whitespace left sitting directly in front of
 * normal sentence punctuation (. , ! ? : ; ) ] }) is also removed - e.g.
 * "Hello 😊!" becomes "Hello!", not "Hello !" - since that stray space is
 * an artifact of the emoji that used to be there, not intentional
 * spacing. Spacing anywhere else in the text is left exactly as-is.
 * ==========================================
 */

const EMOJI_PATTERN = new RegExp(
    "\\p{Extended_Pictographic}" +
    "|\\p{Regional_Indicator}" +
    "|\\p{Emoji_Modifier}" +
    "|[\\u{FE0E}\\u{FE0F}\\u{200D}\\u{20E3}]" +
    "|[\\u{E0020}-\\u{E007F}]",
    "gu"
);

// Whitespace immediately before one of these normal sentence-punctuation
// characters is stripped as part of cleanup (see file header above).
const SPACE_BEFORE_PUNCTUATION_PATTERN = /[ \t\f\v]+([.,!?:;)\]}])/g;

/**
 * Removes emojis/emoji-related symbols from text, for TTS use only.
 * Preserves all normal script text (English, Tamil, Japanese, etc.),
 * numbers, and punctuation. Never throws.
 *
 * @param {*} text
 * @returns {string} Sanitized text, safe to pass to a TTS provider.
 *   Returns "" for null/undefined/empty/whitespace-only/emoji-only input.
 */
function sanitizeTtsText(text) {
    if (typeof text !== "string" || text.length === 0) {
        return "";
    }

    let sanitized = text.replace(EMOJI_PATTERN, "");

    // Collapse whitespace left behind by emoji removal (e.g. a run of
    // "  " where two adjacent emojis used to sit) without disturbing
    // intentional line breaks or normal single spaces/punctuation.
    sanitized = sanitized
        .replace(/[ \t\f\v]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .replace(SPACE_BEFORE_PUNCTUATION_PATTERN, "$1")
        .trim();

    return sanitized;
}

module.exports = { sanitizeTtsText };
