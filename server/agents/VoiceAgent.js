const BaseAgent = require('../core/BaseAgent');

/**
 * INTENTIONALLY NOT REGISTERED (see bootstrap.js) - Part 3 audit.
 * Same rationale as VisionAgent.js: no "voice.*" capability is registered
 * in capabilityRegistry, and the task planner never emits one. Real voice
 * (TTS/STT) functionality already exists and is used directly - see
 * services/voiceService.js, invoked by the Character view's voice socket
 * handlers - not through this agent/event-broadcast layer.
 */
class VoiceAgent extends BaseAgent {
    constructor(kernel) {
        super('Voice', kernel);
    }

    async start() {
        super.start();

        this.listen('agent:Voice:request', async (payload) => {
            const { taskId, action } = payload;
            this.broadcast('agent:task:error', {
                taskId,
                error: `No "voice.*" plan capability is registered yet. Real voice I/O exists in services/voiceService.js and is used directly by the Character view, not through this agent - action "${action}" was not routed there.`
            });
        });
    }
}

module.exports = VoiceAgent;
