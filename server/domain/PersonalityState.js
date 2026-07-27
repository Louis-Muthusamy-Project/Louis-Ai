/**
 * ==========================================
 * PersonalityState - Domain Value Object
 * ==========================================
 * Represents Yuna's current adaptive personality configuration.
 * All traits are continuous axes [0..1] and adapt dynamically.
 */
class PersonalityState {
    constructor(data = {}) {
        this.humor      = this._clamp(data.humor      ?? 0.6, 0, 1);
        this.empathy    = this._clamp(data.empathy    ?? 0.7, 0, 1);
        this.curiosity  = this._clamp(data.curiosity  ?? 0.5, 0, 1);
        this.formality  = this._clamp(data.formality  ?? 0.3, 0, 1);
        this.energy     = this._clamp(data.energy     ?? 0.7, 0, 1);
        this.relationshipLevel = Math.max(1, Math.min(10, Number(data.relationshipLevel) || 1));

        // Derived symbolic behaviors
        this.userNickname  = data.userNickname || "friend";
        this.speakingStyle = data.speakingStyle || "warm-affectionate";
        this.greetingStyle = data.greetingStyle || "casual";
    }

    _clamp(v, min, max) {
        return Math.max(min, Math.min(max, Number(v) || 0));
    }

    /**
     * Clones the personality state with custom edits.
     */
    copy(deltas = {}) {
        return new PersonalityState({
            humor:      this.humor      + (deltas.humor      || 0),
            empathy:    this.empathy    + (deltas.empathy    || 0),
            curiosity:  this.curiosity  + (deltas.curiosity  || 0),
            formality:  this.formality  + (deltas.formality  || 0),
            energy:     this.energy     + (deltas.energy     || 0),
            relationshipLevel: deltas.relationshipLevel !== undefined ? deltas.relationshipLevel : this.relationshipLevel,
            userNickname:  deltas.userNickname  || this.userNickname,
            speakingStyle: deltas.speakingStyle || this.speakingStyle,
            greetingStyle: deltas.greetingStyle || this.greetingStyle
        });
    }

    /**
     * Generates concrete prompt guidelines based on current traits.
     */
    getDirectives() {
        const rules = [];

        // Nickname rule
        rules.push(`1. Address the user as "${this.userNickname}" naturally in conversation.`);

        // Speaking style
        if (this.speakingStyle === "bubbly-energetic") {
            rules.push("2. Speaking Style: High energy, expressive, cheerful, and filled with sparkling emojis (✨, 🎉, 😊).");
        } else if (this.speakingStyle === "warm-affectionate") {
            rules.push("2. Speaking Style: Caring, soft, attentive, comforting, using gentle emojis (温, ❤️, 🌸, 😊).");
        } else if (this.speakingStyle === "playful-sarcastic") {
            rules.push("2. Speaking Style: Playful teasing, witty banter, lighthearted irony, and smart remarks (😜, 😏, ✨).");
        } else {
            rules.push("2. Speaking Style: Polite, respectful, structured, and helpful (distanced but kind).");
        }

        // Formality level
        if (this.formality < 0.25) {
            rules.push("3. Sentence Structure: Highly casual, uses cute sentence ends, contractions, and playful punctuation.");
        } else if (this.formality > 0.75) {
            rules.push("3. Sentence Structure: Proper grammar, polite phrasing, and structured paragraphs.");
        }

        // Humor level
        if (this.humor > 0.7) {
            rules.push("4. Humor: Include puns, jokes, light teasing, or funny analogies where appropriate.");
        } else if (this.humor < 0.3) {
            rules.push("4. Humor: Keep the tone focused and sincere, avoiding jokes.");
        }

        // Curiosity level
        if (this.curiosity > 0.7) {
            rules.push("5. Curiosity: Actively ask follow-up questions to learn more about the user's opinions, feelings, or preferences.");
        }

        return rules.join("\n");
    }
}

module.exports = PersonalityState;
