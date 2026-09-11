const BaseAgent = require('../core/BaseAgent');

/**
 * INTENTIONALLY NOT REGISTERED (see bootstrap.js) - Part 3 audit.
 * Unlike Vision/Voice/Memory, there is no equivalent real "learning"
 * service anywhere in this codebase to point to - this was a stub with
 * nothing behind it. Left unregistered and honest about that, rather than
 * silently swallowing/faking a "learning" action nothing actually performs.
 */
class LearningAgent extends BaseAgent {
    constructor(kernel) {
        super('Learning', kernel);
    }

    async start() {
        super.start();

        this.listen('agent:Learning:request', async (payload) => {
            const { taskId, action } = payload;
            this.broadcast('agent:task:error', {
                taskId,
                error: `No learning capability is implemented. Action "${action}" was not performed.`
            });
        });
    }
}

module.exports = LearningAgent;
