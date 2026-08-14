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
        
        // Enforce strict schema validation
        const requiredFields = ["description", "permission", "riskLevel", "timeoutMs"];
        for (const field of requiredFields) {
            if (capability[field] === undefined) {
                console.warn(`[CapabilityRegistry] Capability '${capability.id}' is missing required field: ${field}. Using default.`);
            }
        }
        
        capability.riskLevel = capability.riskLevel || "low";
        capability.timeoutMs = capability.timeoutMs || 30000;
        capability.supportCancellation = !!capability.supportCancellation;
        capability.permission = capability.permission || "none";
        
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
