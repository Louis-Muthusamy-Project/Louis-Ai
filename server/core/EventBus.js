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
    }

    /**
     * Publishes an event safely catching any errors in down-stream listeners
     */
    publish(event, payload = {}) {
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
