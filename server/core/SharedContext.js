/**
 * SharedContext - A centralized in-memory whiteboard for Multi-Agent coordination.
 * Agents can read/write shared state to avoid passing large payloads over the event bus.
 */
class SharedContext {
    constructor(ttlMs = 3600000) { // Default 1 hour TTL
        this.store = new Map();
        this.ttlMs = ttlMs;
        
        // Auto-cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    set(key, value) {
        this.store.set(key, { value, timestamp: Date.now() });
    }

    get(key) {
        const item = this.store.get(key);
        return item ? item.value : undefined;
    }

    has(key) {
        return this.store.has(key);
    }

    delete(key) {
        this.store.delete(key);
    }

    clear() {
        this.store.clear();
    }
    
    dump() {
        const obj = {};
        for (const [key, item] of this.store.entries()) {
            obj[key] = item.value;
        }
        return obj;
    }

    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.store.entries()) {
            if (now - item.timestamp > this.ttlMs) {
                this.store.delete(key);
            }
        }
    }

    destroy() {
        clearInterval(this.cleanupInterval);
        this.clear();
    }
}

module.exports = SharedContext;
