/**
 * SharedContext - A centralized in-memory whiteboard for Multi-Agent coordination.
 * Agents can read/write shared state to avoid passing large payloads over the event bus.
 */
class SharedContext {
    constructor() {
        this.store = new Map();
    }

    set(key, value) {
        this.store.set(key, value);
    }

    get(key) {
        return this.store.get(key);
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
        return Object.fromEntries(this.store);
    }
}

module.exports = SharedContext;
