const { randomUUID } = require("crypto");
const Message = require("./Message");

/**
 * ==========================================
 * Session - Domain Entity
 * ==========================================
 */
class Session {
    constructor(socketId, id = null, createdAt = null, messages = []) {
        this.id = id || randomUUID();
        this.socketId = socketId;
        this.createdAt = createdAt || new Date();
        this.updatedAt = new Date();
        this.messages = messages.map(m => new Message(m.role, m.text, m.id, m.createdAt));
    }

    addMessage(role, text) {
        const message = new Message(role, text);
        this.messages.push(message);
        this.updatedAt = new Date();
        return message;
    }

    trim(maxHistory) {
        if (this.messages.length > maxHistory) {
            this.messages.splice(0, this.messages.length - maxHistory);
        }
        this.updatedAt = new Date();
    }

    getHistory() {
        return this.messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));
    }

    toJSON() {
        return {
            id: this.id,
            socketId: this.socketId,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
            messages: this.messages.map(m => m.toJSON())
        };
    }
}

module.exports = Session;
