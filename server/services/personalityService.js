function detectPersonalityChange(message) {
    const text = message.toLowerCase();

    if (text.includes("short replies")) {
        return { replyStyle: "short" };
    }

    if (text.includes("long replies")) {
        return { replyStyle: "long" };
    }

    if (text.includes("be formal")) {
        return { tone: "formal" };
    }

    if (text.includes("talk like anime")) {
        return { tone: "anime" };
    }

    if (text.includes("be casual")) {
        return { tone: "casual" };
    }

    return null;
}

module.exports = {
    detectPersonalityChange,
};