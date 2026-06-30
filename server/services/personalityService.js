function includesAny(text, phrases) {
    return phrases.some((phrase) => text.includes(phrase));
}

function detectPersonalityChange(message = "") {
    if (typeof message !== "string") {
        return null;
    }

    const text = message.toLowerCase();
    const update = {};

    if (includesAny(text, ["short replies", "reply shortly", "keep it short", "be brief"])) {
        update.replyStyle = "short";
    }

    if (includesAny(text, ["long replies", "detailed replies", "explain more", "be detailed"])) {
        update.replyStyle = "long";
    }

    if (includesAny(text, ["be formal", "speak formally", "professional tone"])) {
        update.tone = "formal";
    }

    if (includesAny(text, ["be casual", "talk casually", "speak casually"])) {
        update.tone = "casual";
    }

    if (includesAny(text, ["be cute", "talk cute", "sound cute"])) {
        update.tone = "cute";
    }

    if (includesAny(text, ["talk like anime", "anime style", "be anime"])) {
        update.tone = "anime";
    }

    if (includesAny(text, ["be professional", "act professional"])) {
        update.tone = "professional";
    }

    if (includesAny(text, ["be funny", "make jokes", "joke with me"])) {
        update.mood = "funny";
    }

    if (includesAny(text, ["be serious", "take this seriously", "serious tone"])) {
        update.mood = "serious";
    }

    if (includesAny(text, ["use emojis", "use emoji", "more emojis"])) {
        update.emojiPreference = "more";
        update.preference = { type: "emoji", value: "more" };
    }

    if (includesAny(text, ["no emojis", "don't use emojis", "less emojis"])) {
        update.emojiPreference = "less";
        update.preference = { type: "emoji", value: "less" };
    }

    const languageMatch = text.match(/\b(?:speak|talk|reply)\s+(?:in\s+)?([a-zA-Z+-]{2,30})\b/);
    if (languageMatch?.[1]) {
        update.languagePreference = languageMatch[1].toLowerCase();
        update.preference = {
            type: "language",
            value: update.languagePreference,
        };
    }

    return Object.keys(update).length ? update : null;
}

module.exports = {
    detectPersonalityChange,
};
