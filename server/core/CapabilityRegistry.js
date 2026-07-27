/**
 * ==========================================
 * Yuna CapabilityRegistry
 * ==========================================
 */
class CapabilityRegistry {
    constructor() {
        this.capabilities = new Map();
    }

    register(capability) {
        if (!capability || !capability.id) {
            throw new Error("Invalid capability. Must have a unique 'id'.");
        }
        this.capabilities.set(capability.id, capability);
    }

    get(id) {
        return this.capabilities.get(id);
    }

    list() {
        return [...this.capabilities.values()];
    }

    async initializeAll(kernel) {
        for (const capability of this.capabilities.values()) {
            if (typeof capability.initialize === "function") {
                await capability.initialize(kernel);
            }
        }
    }
}

module.exports = new CapabilityRegistry();
