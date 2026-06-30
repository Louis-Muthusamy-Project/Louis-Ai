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

    if (!update || typeof update !== "object") {
        return data;
    }

    if (update.tone) data.tone = update.tone;
    if (update.replyStyle) data.replyStyle = update.replyStyle;
    if (update.mood) data.mood = update.mood;
    if (update.emojiPreference) data.emojiPreference = update.emojiPreference;
    if (update.languagePreference) data.languagePreference = update.languagePreference;

    if (update.preference) {
        const exists = data.preferences.some(
            (preference) =>
                preference.type === update.preference.type &&
                preference.value === update.preference.value
        );

        if (!exists) {
            data.preferences.push(update.preference);
        }
    }

    return data;
}

function clearPersonality(socketId) {
    delete personalityDB[socketId];
}

module.exports = {
    getPersonality,
    updatePersonality,
    clearPersonality,
};
