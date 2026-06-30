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
    emotionDB[socketId] = {
        ...getEmotion(socketId),
        ...emotion,
    };
}

module.exports = {
    getEmotion,
    setEmotion,
};