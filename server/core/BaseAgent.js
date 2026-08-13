const EventEmitter = require("events");

/**
 * BaseAgent - The abstract base class for all Yuna multi-agents.
 */
class BaseAgent {
    constructor(name, kernel) {
        this.name = name;
        this.kernel = kernel;
        this.eventBus = kernel.get("eventBus");
        this.sharedContext = kernel.get("sharedContext");
    }

    /**
     * Subscribe to a topic on the message bus.
     */
    listen(topic, handler) {
        this.eventBus.on(topic, async (payload) => {
            try {
                await handler(payload);
            } catch (error) {
                console.error(`[Agent:${this.name}] Error in topic ${topic}:`, error.message);
            }
        });
    }

    /**
     * Broadcast a message to other agents.
     */
    broadcast(topic, payload) {
        this.eventBus.emit(topic, {
            ...payload,
            _sender: this.name,
            _timestamp: Date.now()
        });
    }

    /**
     * Write to the shared context (whiteboard).
     */
    writeContext(key, value) {
        this.sharedContext.set(key, value);
    }

    /**
     * Read from the shared context.
     */
    readContext(key) {
        return this.sharedContext.get(key);
    }

    /**
     * Lifecycle method called when the agent is starting.
     * Override this to setup listeners.
     */
    async start() {
        console.log(`[Agent:${this.name}] Started.`);
    }
}

module.exports = BaseAgent;
