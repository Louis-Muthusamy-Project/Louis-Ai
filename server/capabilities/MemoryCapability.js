const BaseCapability = require("./BaseCapability");

/**
 * This capability exists in the agent/plan dispatch registry, but real
 * memory reads/writes for chat already flow through memoryService directly
 * (AIOrchestrator -> memoryService, keyed by the authenticated userId) -
 * not through this capability's execute(). It previously faked success on
 * any input without doing anything. Rather than pretend to support
 * arbitrary AI-plan-driven memory actions it doesn't implement, this now
 * says so honestly.
 */
class MemoryCapability extends BaseCapability {

    constructor() {
        super("memory", "Conversation Memory", {
            description: "Conversation memory is managed automatically per chat turn via memoryService; this capability does not expose separate plan-driven actions.",
            permission: "user-data",
            riskLevel: "low",
            timeoutMs: 5000
        });
    }

    async execute(input) {
        return {
            success: false,
            message: "Memory capability has no standalone actions - memory is read/written automatically as part of chat, not via plan-driven calls."
        };
    }

}

module.exports = new MemoryCapability();
