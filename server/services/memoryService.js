const ENDING_PUNCTUATION = /[.!?]+$/;

function cleanValue(value = "") {
    return value
        .trim()
        .replace(ENDING_PUNCTUATION, "")
        .replace(/\s+/g, " ");
}

function toTitleCase(value = "") {
    return value
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

function matchFirst(message, patterns) {
    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match?.[1]) {
            return cleanValue(match[1]);
        }
    }

    return null;
}

function extractMemory(userMessage = "") {
    if (typeof userMessage !== "string") {
        return null;
    }

    const message = cleanValue(userMessage);

    const name = matchFirst(message, [
        /\bmy name is\s+([a-zA-Z][a-zA-Z\s'-]{0,40})$/i,
        /\bi am\s+([a-zA-Z][a-zA-Z\s'-]{0,40})$/i,
        /\bi'm\s+([a-zA-Z][a-zA-Z\s'-]{0,40})$/i,
        /\bcall me\s+([a-zA-Z][a-zA-Z\s'-]{0,40})$/i,
    ]);

    if (name) {
        return {
            type: "name",
            value: toTitleCase(name),
        };
    }

    const nickname = matchFirst(message, [
        /\bmy nickname is\s+([a-zA-Z][a-zA-Z\s'-]{0,40})$/i,
        /\bmy nick name is\s+([a-zA-Z][a-zA-Z\s'-]{0,40})$/i,
    ]);

    if (nickname) {
        return {
            type: "nickname",
            value: toTitleCase(nickname),
        };
    }

    const language = matchFirst(message, [
        /\bmy favou?rite language is\s+([a-zA-Z][a-zA-Z\s+-]{0,40})$/i,
        /\bi prefer\s+([a-zA-Z][a-zA-Z\s+-]{0,40})\s+language$/i,
    ]);

    if (language) {
        return {
            type: "language",
            value: toTitleCase(language),
        };
    }

    const like = matchFirst(message, [
        /\bi like\s+(.{2,80})$/i,
        /\bi love\s+(.{2,80})$/i,
    ]);

    if (like) {
        return {
            type: "like",
            value: like.toLowerCase(),
        };
    }

    return null;
}

module.exports = {
    extractMemory,
};
