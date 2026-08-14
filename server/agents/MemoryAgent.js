const BaseAgent = require('../core/BaseAgent');

class MemoryAgent extends BaseAgent {
    constructor(kernel) {
        super('Memory', kernel);
    }

    async start() {
        super.start();
        
        this.listen('agent:Memory:request', async (payload) => {
            const { taskId, action, params } = payload;
            try {
                throw new Error(`${this.name} capability for ${action} is not implemented yet.`);
            } catch (error) {
                this.broadcast('agent:task:error', { taskId, error: error.message });
            }
        });
    }
}

module.exports = MemoryAgent;
