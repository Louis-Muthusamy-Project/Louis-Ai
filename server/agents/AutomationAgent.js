const BaseAgent = require('../core/BaseAgent');

class AutomationAgent extends BaseAgent {
    constructor(kernel) {
        super('Automation', kernel);
    }

    async start() {
        super.start();
        
        this.listen('agent:Automation:request', async (payload) => {
            const { taskId, action, params } = payload;
            try {
                const capability = this.kernel.get("capabilityRegistry").get(action);
                if (!capability) {
                    throw new Error(`Capability ${action} is not registered.`);
                }
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

module.exports = AutomationAgent;
