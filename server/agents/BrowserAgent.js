const BaseAgent = require('../core/BaseAgent');

/**
 * BrowserAgent dispatches "browser.*"-namespaced plan steps to the real,
 * already-implemented BrowserCapability (server/capabilities/BrowserCapability.js -
 * a genuine Puppeteer-backed browser automation capability, not a stub).
 * This mirrors the same generic capabilityRegistry.execute() pattern
 * ExecutorAgent/AutomationAgent already use, rather than reimplementing
 * browser control here.
 */
class BrowserAgent extends BaseAgent {
    constructor(kernel) {
        super('Browser', kernel);
    }

    async start() {
        super.start();

        this.listen('agent:Browser:request', async (payload) => {
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

module.exports = BrowserAgent;
