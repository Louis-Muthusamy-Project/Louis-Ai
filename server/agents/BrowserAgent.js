const BaseAgent = require('../core/BaseAgent');

class BrowserAgent extends BaseAgent {
    constructor(kernel) {
        super('Browser', kernel);
    }

    async start() {
        super.start();
        
        this.listen('agent:Browser:request', async (payload) => {
            const { taskId, action, params } = payload;
            try {
                // TODO: Wire up actual capability/service here
                console.log(`[${this.name}] Executing ${action}`);
                this.broadcast('agent:task:complete', { taskId, result: { success: true, message: `${this.name} finished ${action}` } });
            } catch (error) {
                this.broadcast('agent:task:error', { taskId, error: error.message });
            }
        });
    }
}

module.exports = BrowserAgent;