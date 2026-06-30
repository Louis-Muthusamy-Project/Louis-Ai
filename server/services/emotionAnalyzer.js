function analyzeEmotionPattern(history = []) {
    if (!history.length) {
        return {
            dominant: "neutral",
            trend: "stable",
        };
    }

    let happy = 0;
    let sad = 0;
    let angry = 0;
    let excited = 0;

    history.forEach((h) => {
        switch (h.mood) {
            case "happy":
                happy++;
                break;
            case "sad":
                sad++;
                break;
            case "angry":
                angry++;
                break;
            case "excited":
                excited++;
                break;
        }
    });

    const max = Math.max(happy, sad, angry, excited);

    let dominant = "neutral";

    if (max === happy) dominant = "happy";
    if (max === sad) dominant = "sad";
    if (max === angry) dominant = "angry";
    if (max === excited) dominant = "excited";

    // trend detection
    const last = history.slice(-5);

    let trend = "stable";
    if (last.length >= 3) {
        const recentSad = last.filter(h => h.mood === "sad").length;
        const recentHappy = last.filter(h => h.mood === "happy").length;

        if (recentSad > recentHappy + 1) trend = "declining";
        if (recentHappy > recentSad + 1) trend = "improving";
    }

    return {
        dominant,
        trend,
    };
}

module.exports = {
    analyzeEmotionPattern,
};