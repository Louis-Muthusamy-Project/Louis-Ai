const Kernel = require("../core/Kernel");

/**
 * ==========================================
 * MemoryService - Refactored Service Class
 * ==========================================
 */
class MemoryService {
    constructor(kernel) {
        this.kernel = kernel;
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

// Wrapper object referencing Kernel's DI instance
const wrapper = {
    getShortMemory: (s) => Kernel.get("memoryService").getShortMemory(s),
    addShortMemory: (s, r, t) => Kernel.get("memoryService").addShortMemory(s, r, t),
    clearShortMemory: (s) => Kernel.get("memoryService").clearShortMemory(s),
    saveLongMemory: (u, k, v) => Kernel.get("memoryService").saveLongMemory(u, k, v),
    getLongMemory: (u) => Kernel.get("memoryService").getLongMemory(u),
    removeLongMemory: (u, k) => Kernel.get("memoryService").removeLongMemory(u, k),
    getSummary: (s) => Kernel.get("memoryService").getSummary(s)
};

module.exports = Object.assign(wrapper, { MemoryService });