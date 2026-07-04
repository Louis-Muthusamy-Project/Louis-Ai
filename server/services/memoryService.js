/**
 * ==========================================
 * Memory Service
 * ------------------------------------------
 * Handles:
 * - Short Memory
 * - Session Memory
 * - Long Memory (Future MongoDB)
 * ==========================================
 */

class MemoryService {

    constructor() {

        this.shortMemory = new Map();

        this.longMemory = new Map();

        this.maxShortMemory = 20;

    }

    getShortMemory(socketId) {

        if (!this.shortMemory.has(socketId)) {
            this.shortMemory.set(socketId, []);
        }

        return this.shortMemory.get(socketId);

    }

    addShortMemory(socketId, role, text) {

        const memory = this.getShortMemory(socketId);

        memory.push({
            role,
            text,
            createdAt: new Date().toISOString()
        });

        if (memory.length > this.maxShortMemory) {
            memory.shift();
        }

    }

    clearShortMemory(socketId) {

        this.shortMemory.delete(socketId);

    }

    saveLongMemory(userId, key, value) {

        if (!this.longMemory.has(userId)) {
            this.longMemory.set(userId, {});
        }

        const userMemory = this.longMemory.get(userId);

        userMemory[key] = value;

    }

    getLongMemory(userId) {

        return this.longMemory.get(userId) || {};

    }

    removeLongMemory(userId, key) {

        if (!this.longMemory.has(userId)) {
            return;
        }

        const userMemory = this.longMemory.get(userId);

        delete userMemory[key];

    }

    getSummary(socketId) {

        const memory = this.getShortMemory(socketId);

        return memory.map(item => ({
            role: item.role,
            text: item.text
        }));

    }

}

module.exports = new MemoryService();