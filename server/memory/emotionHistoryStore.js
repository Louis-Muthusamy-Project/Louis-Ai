const emotionHistoryDB = {};

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

    history.push({
        mood: emotion.mood,
        intensity: emotion.intensity,
        time: Date.now(),
    });

    // limit memory size (avoid overload)
    if (history.length > 50) {
        history.shift();
    }
}

module.exports = {
    getHistory,
    addEmotion,
};