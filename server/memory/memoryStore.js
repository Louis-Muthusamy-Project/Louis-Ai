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
            facts: [],
        };
    }
    return memory[socketId];
}

function updateMemory(socketId, data) {
    const userMemory = getMemory(socketId);

    if (data.name) {
        userMemory.name = data.name;
    }

    if (data.fact) {
        userMemory.facts.push(data.fact);
    }
}

function clearMemory(socketId) {
    delete memory[socketId];
}

module.exports = {
    getMemory,
    updateMemory,
    clearMemory,
};