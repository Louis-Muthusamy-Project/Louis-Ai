const MOOD_SIGNALS = [
    {
        mood: "depressed",
        intensity: 90,
        confidence: 0.9,
        phrases: ["i'm depressed", "i am depressed", "feel depressed", "hopeless"],
    },
    {
        mood: "anxious",
        intensity: 78,
        confidence: 0.84,
        phrases: ["i'm anxious", "i am anxious", "anxiety", "nervous", "panicking"],
    },
    {
        mood: "stressed",
        intensity: 76,
        confidence: 0.82,
        phrases: ["i'm stressed", "i am stressed", "stressed out", "overwhelmed"],
    },
    {
        mood: "scared",
        intensity: 78,
        confidence: 0.82,
        phrases: ["i'm scared", "i am scared", "afraid", "frightened", "terrified"],
    },
    {
        mood: "angry",
        intensity: 82,
        confidence: 0.82,
        phrases: ["i'm angry", "i am angry", "angry", "furious", "hate"],
    },
    {
        mood: "frustrated",
        intensity: 72,
        confidence: 0.8,
        phrases: ["i'm frustrated", "i am frustrated", "frustrated", "annoyed", "irritated"],
    },
    {
        mood: "sad",
        intensity: 75,
        confidence: 0.84,
        phrases: ["i'm sad", "i am sad", "sad", "unhappy", "crying"],
    },
    {
        mood: "lonely",
        intensity: 74,
        confidence: 0.82,
        phrases: ["i'm lonely", "i am lonely", "lonely", "alone"],
    },
    {
        mood: "tired",
        intensity: 64,
        confidence: 0.78,
        phrases: ["i'm tired", "i am tired", "exhausted", "sleepy", "burned out"],
    },
    {
        mood: "excited",
        intensity: 86,
        confidence: 0.84,
        phrases: ["i'm excited", "i am excited", "excited", "awesome", "wow", "can't wait"],
    },
    {
        mood: "happy",
        intensity: 80,
        confidence: 0.82,
        phrases: ["i'm happy", "i am happy", "happy", "glad", "love this", "so good"],
    },
];

function detectEmotion(message = "") {
    if (typeof message !== "string") {
        return { mood: "neutral", intensity: 50, confidence: 0.4 };
    }

    const text = message.toLowerCase();

    for (const signal of MOOD_SIGNALS) {
        if (signal.phrases.some((phrase) => text.includes(phrase))) {
            return {
                mood: signal.mood,
                intensity: signal.intensity,
                confidence: signal.confidence,
            };
        }
    }

    return { mood: "neutral", intensity: 50, confidence: 0.45 };
}

module.exports = {
    detectEmotion,
};
