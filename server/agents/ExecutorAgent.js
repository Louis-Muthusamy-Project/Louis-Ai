const BaseAgent = require('../core/BaseAgent');

class ExecutorAgent extends BaseAgent {
    constructor(kernel) {
        super('Executor', kernel);
    }

    async start() {
        super.start();
        
        this.listen('agent:Executor:request', async (payload) => {
            const { taskId, action, params } = payload;
            try {
                // Action is the capabilityId
                const capability = this.kernel.get("capabilityRegistry").get(action);
                if (!capability) {
                    throw new Error(`Capability ${action} is not registered.`);
                }
                
                // For now, we assume capability has an execute method
                // Or if it maps to a tool, we use the active ToolManager (mocked here if absent)
                // Real implementation should invoke the capability's handler
                if (typeof capability.execute === "function") {
                    const result = await capability.execute(params);
                    this.broadcast('agent:task:complete', { taskId, result });
                } else {
                    throw new Error(`Capability ${action} missing execute method.`);
                }
            } catch (error) {
                this.broadcast('agent:task:error', { taskId, error: error.message });
            }
        });
    }
}

module.exports = ExecutorAgent;
