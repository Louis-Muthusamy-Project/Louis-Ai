const emotionHistoryDB = {};
const MAX_HISTORY_SIZE = 50;
const DUPLICATE_WINDOW_MS = 30000;

/**
 * Structure:
 * emotionHistoryDB = {
 *   socketId: [
 *     { mood: "happy", intensity: 80, time: 123456 },
 *     { mood: "sad", intensity: 70, time: 123457 }
 *   ]
 * }
 */

function getHistory(socketId) {
    if (!emotionHistoryDB[socketId]) {
        emotionHistoryDB[socketId] = [];
    }
    return emotionHistoryDB[socketId];
}

function addEmotion(socketId, emotion) {
    const history = getHistory(socketId);
    const now = Date.now();
    const last = history[history.length - 1];

    if (!emotion || !emotion.mood) {
        return history;
    }

    if (
        last &&
        last.mood === emotion.mood &&
        last.intensity === emotion.intensity &&
        now - last.time < DUPLICATE_WINDOW_MS
    ) {
        return history;
    }

    history.push({
        mood: emotion.mood,
        intensity: emotion.intensity,
        confidence: emotion.confidence ?? 0.5,
        time: now,
    });

    while (history.length > MAX_HISTORY_SIZE) {
        history.shift();
    }

    return history;
}

function clearHistory(socketId) {
    delete emotionHistoryDB[socketId];
}

module.exports = {
    getHistory,
    addEmotion,
    clearHistory,
};
