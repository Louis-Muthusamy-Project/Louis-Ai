const BaseAgent = require('../core/BaseAgent');

/**
 * CodingAgent dispatches "coding.*"-namespaced plan steps to the real,
 * already-implemented CodingCapability (server/capabilities/CodingCapability.js -
 * shell commands + AI code review/docs/error-analysis, permission-gated),
 * using the same generic capabilityRegistry.execute() pattern
 * ExecutorAgent/AutomationAgent already use.
 *
 * NOTE: this is distinct from the dedicated Coding tab/workspace (file
 * explorer/editor/terminal/git - see CodingWorkspaceCapability and
 * socket/socketHandler.js's CODING_* events), which already has its own
 * real, directly-wired implementation and does not go through this
 * agent/event-broadcast path at all.
 */
class CodingAgent extends BaseAgent {
    constructor(kernel) {
        super('Coding', kernel);
    }

    async start() {
        super.start();

        this.listen('agent:Coding:request', async (payload) => {
            const { taskId, action, params } = payload;
            try {
                const capability = this.kernel.get("capabilityRegistry").get(action);
                if (!capability) {
                    throw new Error(`Capability ${action} is not registered.`);
                }
                if (typeof capability.execute !== "function") {
                    throw new Error(`Capability ${action} missing execute method.`);
                }
                const result = await capability.execute(params);
                this.broadcast('agent:task:complete', { taskId, result });
            } catch (error) {
                this.broadcast('agent:task:error', { taskId, error: error.message });
            }
        });
    }
}

module.exports = CodingAgent;
