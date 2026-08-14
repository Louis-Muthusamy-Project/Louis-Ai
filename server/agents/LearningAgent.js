const BaseAgent = require('../core/BaseAgent');

class LearningAgent extends BaseAgent {
    constructor(kernel) {
        super('Learning', kernel);
    }

    async start() {
        super.start();
        
        this.listen('agent:Learning:request', async (payload) => {
            const { taskId, action, params } = payload;
            try {
                throw new Error(`${this.name} capability for ${action} is not implemented yet.`);
            } catch (error) {
                this.broadcast('agent:task:error', { taskId, error: error.message });
            }
        });
    }
}

module.exports = LearningAgent;
