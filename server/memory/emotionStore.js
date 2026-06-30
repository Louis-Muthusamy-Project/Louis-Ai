const emotionDB = {};

/**
 * Structure:
 * emotionDB = {
 *   socketId: {
 *     mood: "neutral",
 *     intensity: 0-100
 *   }
 * }
 */

function getEmotion(socketId) {
    if (!emotionDB[socketId]) {
        emotionDB[socketId] = {
            mood: "neutral",
            intensity: 50,
        };
    }
    return emotionDB[socketId];
}

function setEmotion(socketId, emotion) {
    if (!emotion || typeof emotion !== "object") {
        return getEmotion(socketId);
    }

    emotionDB[socketId] = {
        ...getEmotion(socketId),
        ...emotion,
    };

    return emotionDB[socketId];
}

function clearEmotion(socketId) {
    delete emotionDB[socketId];
}

module.exports = {
    getEmotion,
    setEmotion,
    clearEmotion,
};
