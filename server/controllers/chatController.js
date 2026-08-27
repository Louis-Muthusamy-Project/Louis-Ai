// Refactored Chat Controller using Kernel DI
const Kernel = require("../core/Kernel");
const Events = require("../socket/socketEvents");

async function handleChatMessage(socket, payload = {}) {
    try {
        const userId = socket.data && socket.data.user && socket.data.user.id;
        if (!userId) {
            socket.emit(Events.MESSAGE_ERROR, {
                message: "Not authenticated.",
                createdAt: new Date().toISOString()
            });
            return;
        }

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

        const result = await aiOrchestrator.streamReply(
            userId,
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

        // Emit full cognitive emotion state for Live2D/UI integration
        if (result && result.emotionState) {
            socket.emit(Events.EMOTION_UPDATE, result.emotionState);
        }
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