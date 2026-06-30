function detectEmotion(message) {
    const text = message.toLowerCase();

    // Angry signals
    if (text.includes("hate") || text.includes("angry")) {
        return { mood: "angry", intensity: 80 };
    }

    // Sad signals
    if (text.includes("sad") || text.includes("lonely")) {
        return { mood: "sad", intensity: 75 };
    }

    // Happy signals
    if (text.includes("happy") || text.includes("love")) {
        return { mood: "happy", intensity: 85 };
    }

    // Excited signals
    if (text.includes("wow") || text.includes("awesome")) {
        return { mood: "excited", intensity: 90 };
    }

    return { mood: "neutral", intensity: 50 };
}

module.exports = {
    detectEmotion,
};