// Refactored Chat Controller using Kernel DI
const Kernel = require("../core/Kernel");
const Events = require("../socket/socketEvents");

/**
 * Handles incoming chat messages from a socket.
 * Utilizes the AIOrchestrator service via the Kernel DI container.
 * Emits socket events for client updates.
 */
async function handleChatMessage(socket, payload = {}) {
    try {
        const text = typeof payload.text === "string" ? payload.text.trim() : "";
        if (!text) {
            socket.emit(Events.MESSAGE_ERROR, {
                message: "Message cannot be empty.",
                createdAt: new Date().toISOString()
            });
            return;
        }
        // Resolve services from the Kernel container
        const aiOrchestrator = Kernel.get("aiOrchestrator");
        const eventBus = Kernel.get("eventBus"); // For internal publish/subscribe if needed

        // Stream reply using orchestrator callbacks
        const result = await aiOrchestrator.streamReply(
            socket.id,
            text,
            {
                onStart: async () => {
                    socket.emit(Events.THINKING_START);
                    socket.emit(Events.TYPING_START);
                    socket.emit(Events.STREAM_START);
                },
                onChunk: async (chunk) => {
                    socket.emit(Events.STREAM_CHUNK, chunk);
                },
                onComplete: async (finalText) => {
                    socket.emit(Events.STREAM_END);
                    socket.emit(Events.TYPING_STOP);
                    socket.emit(Events.THINKING_END);
                }
            }
        );
        // Publish a server‑side event (optional, can be used by other modules)
        if (eventBus && typeof eventBus.publish === "function") {
            eventBus.publish("chat:reply", { socketId: socket.id, result });
        }
        socket.emit(Events.MESSAGE_REPLY, result);
    } catch (error) {
        console.error(error);
        // Ensure thinking end is emitted on error
        socket.emit(Events.THINKING_END);
        socket.emit(Events.MESSAGE_ERROR, {
            message: error.message,
            createdAt: new Date().toISOString()
        });
    }
}

module.exports = {
    handleChatMessage
};