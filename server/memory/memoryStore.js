const memory = {};

/**
 * Structure:
 * memory = {
 *   socketId: {
 *     name: "Louis",
 *     facts: []
 *   }
 * }
 */

function getMemory(socketId) {
    if (!memory[socketId]) {
        memory[socketId] = {
            name: null,
            nickname: null,
            language: null,
            likes: [],
            facts: [],
        };
    }
    return memory[socketId];
}

function updateMemory(socketId, data) {
    const userMemory = getMemory(socketId);

    if (!data || typeof data !== "object") {
        return userMemory;
    }

    if (data.name) {
        userMemory.name = data.name;
    }

    if (data.nickname) {
        userMemory.nickname = data.nickname;
    }

    if (data.language) {
        userMemory.language = data.language;
    }

    if (data.like && !userMemory.likes.includes(data.like)) {
        userMemory.likes.push(data.like);
    }

    if (data.fact) {
        const exists = userMemory.facts.some(
            (fact) => fact.type === data.fact.type && fact.value === data.fact.value
        );

        if (!exists) {
            userMemory.facts.push(data.fact);
        }
    }

    return userMemory;
}

function clearMemory(socketId) {
    delete memory[socketId];
}

module.exports = {
    getMemory,
    updateMemory,
    clearMemory,
};
