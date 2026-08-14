const BaseAgent = require('../core/BaseAgent');

class CodingAgent extends BaseAgent {
    constructor(kernel) {
        super('Coding', kernel);
    }

    async start() {
        super.start();
        
        this.listen('agent:Coding:request', async (payload) => {
            const { taskId, action, params } = payload;
            try {
                throw new Error(`${this.name} capability for ${action} is not implemented yet.`);
            } catch (error) {
                this.broadcast('agent:task:error', { taskId, error: error.message });
            }
        });
    }
}

module.exports = CodingAgent;
