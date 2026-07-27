const { randomUUID } = require("crypto");

/**
 * ==========================================
 * Message - Domain Value Object
 * ==========================================
 */
class Message {
    constructor(role, text, id = null, createdAt = null) {
        if (!role || !["user", "model", "assistant"].includes(role)) {
            throw new Error(`Invalid message role: "${role}"`);
        }
        this.id = id || randomUUID();
        this.role = role === "assistant" ? "model" : role; // Map to LLM expectation internally
        this.text = text ? text.trim() : "";
        this.createdAt = createdAt || new Date().toISOString();
    }

    toJSON() {
        return {
            id: this.id,
            role: this.role,
            text: this.text,
            createdAt: this.createdAt
        };
    }
}

module.exports = Message;
