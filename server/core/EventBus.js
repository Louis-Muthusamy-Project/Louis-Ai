const EventEmitter = require("events");

/**
 * ==========================================
 * Yuna EventBus - Core Decoupled Pub/Sub
 * ==========================================
 */
class EventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100); // Allow higher listener thresholds for rich socket architectures
        
        // Define standard Event Contracts
        this.contracts = {
            "user.message.received": ["socketId", "text"],
            "ai.thinking.started": ["socketId"],
            "plan.created": ["socketId", "steps"],
            "task.started": ["socketId", "capability"],
            "task.completed": ["socketId", "capability", "result"],
            "task.failed": ["socketId", "capability", "error"],
            "permission.requested": ["socketId", "requestId", "capabilityId", "riskLevel", "details"],
            "permission.granted": ["requestId"],
            "permission.denied": ["requestId"],
            "state.transition": ["from", "to", "socketId"]
        };
    }

    /**
     * Publishes an event safely catching any errors in down-stream listeners
     * Also validates against known contracts if defined.
     */
    publish(event, payload = {}) {
        if (this.contracts[event]) {
            for (const requiredField of this.contracts[event]) {
                if (payload[requiredField] === undefined) {
                    console.warn(`[EventBus] Warning: Event '${event}' is missing contracted field '${requiredField}'`);
                }
            }
        }
        
        try {
            this.emit(event, payload);
        } catch (error) {
            console.error(`[EventBus] Error publishing event "${event}":`, error);
        }
    }

    /**
     * Subscribes to an event
     */
    subscribe(event, listener) {
        this.on(event, listener);
        return () => this.off(event, listener);
    }
}

module.exports = new EventBus();
