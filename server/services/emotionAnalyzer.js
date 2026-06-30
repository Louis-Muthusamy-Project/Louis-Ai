const POSITIVE_MOODS = new Set(["happy", "excited"]);
const NEGATIVE_MOODS = new Set([
    "sad",
    "depressed",
    "stressed",
    "anxious",
    "lonely",
    "scared",
    "angry",
    "frustrated",
    "tired",
]);

function moodScore(entry) {
    const intensity = Number(entry?.intensity) || 50;

    if (POSITIVE_MOODS.has(entry?.mood)) return intensity;
    if (NEGATIVE_MOODS.has(entry?.mood)) return -intensity;
    return 0;
}

function analyzeEmotionPattern(history = []) {
    if (!Array.isArray(history) || !history.length) {
        return {
            dominantMood: "neutral",
            dominant: "neutral",
            trend: "stable",
            recentEmotion: { mood: "neutral", intensity: 50, confidence: 0.45 },
            averageIntensity: 50,
        };
    }

    const counts = history.reduce((acc, entry) => {
        if (entry?.mood) {
            acc[entry.mood] = (acc[entry.mood] || 0) + 1;
        }

        return acc;
    }, {});

    const dominantMood = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
    const recentEmotion = history[history.length - 1];
    const averageIntensity = Math.round(
        history.reduce((sum, entry) => sum + (Number(entry?.intensity) || 0), 0) / history.length
    );

    const recent = history.slice(-5);
    const firstHalf = recent.slice(0, Math.ceil(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const firstScore = firstHalf.reduce((sum, entry) => sum + moodScore(entry), 0) / firstHalf.length;
    const secondScore = secondHalf.reduce((sum, entry) => sum + moodScore(entry), 0) / secondHalf.length;

    let trend = "stable";
    if (recent.length >= 3 && secondScore - firstScore > 20) {
        trend = "improving";
    }

    if (recent.length >= 3 && firstScore - secondScore > 20) {
        trend = "declining";
    }

    return {
        dominantMood,
        dominant: dominantMood,
        trend,
        recentEmotion,
        averageIntensity,
    };
}

module.exports = {
    analyzeEmotionPattern,
};
