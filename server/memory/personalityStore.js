const personalityDB = {};

/**
 * Structure:
 * personalityDB = {
 *   socketId: {
 *     tone: "casual | formal | anime",
 *     replyStyle: "short | long",
 *     mood: "friendly",
 *     preferences: []
 *   }
 * }
 */

function getPersonality(socketId) {
    if (!personalityDB[socketId]) {
        personalityDB[socketId] = {
            tone: "anime",
            replyStyle: "normal",
            mood: "friendly",
            preferences: [],
        };
    }
    return personalityDB[socketId];
}

function updatePersonality(socketId, update) {
    const data = getPersonality(socketId);

    if (update.tone) data.tone = update.tone;
    if (update.replyStyle) data.replyStyle = update.replyStyle;

    if (update.preference) {
        data.preferences.push(update.preference);
    }
}

module.exports = {
    getPersonality,
    updatePersonality,
};