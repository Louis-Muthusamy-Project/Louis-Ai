const BaseAgent = require('../core/BaseAgent');

/**
 * INTENTIONALLY NOT REGISTERED (see bootstrap.js) - Part 3 audit.
 * There's a MemoryCapability registered under id "memory" (bare, no dot),
 * but real conversation memory is already read/written automatically every
 * chat turn via services/memoryService.js (called directly from
 * AIOrchestrator, keyed by the authenticated userId) - not through a
 * separate AI-planned "memory.*" action. MemoryCapability.execute() already
 * says this honestly rather than faking a result; this agent would only
 * ever be reached for a "memory.*" plan step the task planner never emits.
 */
class MemoryAgent extends BaseAgent {
    constructor(kernel) {
        super('Memory', kernel);
    }

    async start() {
        super.start();

        this.listen('agent:Memory:request', async (payload) => {
            const { taskId, action } = payload;
            this.broadcast('agent:task:error', {
                taskId,
                error: `No standalone "memory.*" plan action exists - memory is read/written automatically as part of chat via memoryService, not via plan-driven calls. Action "${action}" was not routed there.`
            });
        });
    }
}

module.exports = MemoryAgent;
