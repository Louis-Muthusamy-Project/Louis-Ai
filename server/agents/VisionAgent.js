const BaseAgent = require('../core/BaseAgent');

/**
 * INTENTIONALLY NOT REGISTERED (see bootstrap.js) - Part 3 audit.
 *
 * This class previously listened for 'agent:Vision:request' and threw
 * "not implemented yet" for every action - a registered fake capability.
 * There is no "vision.*" entry in capabilityRegistry to delegate to (unlike
 * BrowserAgent/CodingAgent, which now do), and the AI task planner never
 * emits a "vision" capability id, so wiring this up would mean inventing a
 * new capability rather than fixing a broken connection to a real one.
 *
 * Real vision functionality already exists and is used directly (not
 * through this agent/event-broadcast layer) - see services/visionService.js,
 * invoked by the VISION_PROCESS Socket.IO handler in socket/socketHandler.js.
 *
 * Left unregistered rather than deleted so a future real "vision.*" plan
 * capability has a documented place to be wired in - see BrowserAgent.js
 * for the pattern to follow.
 */
class VisionAgent extends BaseAgent {
    constructor(kernel) {
        super('Vision', kernel);
    }

    async start() {
        super.start();

        this.listen('agent:Vision:request', async (payload) => {
            const { taskId, action } = payload;
            this.broadcast('agent:task:error', {
                taskId,
                error: `No "vision.*" plan capability is registered yet. Real vision processing exists in services/visionService.js and is used directly by the Character/chat socket flow, not through this agent - action "${action}" was not routed there.`
            });
        });
    }
}

module.exports = VisionAgent;
