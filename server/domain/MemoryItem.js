/**
 * ==========================================
 * MemoryItem - Domain Entity
 * ==========================================
 */
class MemoryItem {
    constructor(data = {}) {
        this.id = data.id || `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.text = data.text || "";
        this.embedding = data.embedding || null;
        this.importance = data.importance || 1; // 1-10 scale
        this.category = data.category || "general"; // general, preference, goal, project, relationship, knowledge
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        this.lastRecalledAt = data.lastRecalledAt || new Date().toISOString();
    }

    /**
     * Updates the last recalled timestamp.
     */
    updateRecalled() {
        this.lastRecalledAt = new Date().toISOString();
    }

    /**
     * Serializes memory item for file storage.
     */
    toJSON() {
        return {
            id: this.id,
            text: this.text,
            embedding: this.embedding,
            importance: this.importance,
            category: this.category,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastRecalledAt: this.lastRecalledAt
        };
    }
}

module.exports = MemoryItem;
