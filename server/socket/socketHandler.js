const { handleChatMessage, cancelStream } = require("../controllers/chatController");
const Events = require("./socketEvents");

// userId -> Set<socketId>. A user may have more than one tab/device connected.
const userSockets = new Map();

function _registerUserSocket(userId, socketId) {
    if (!userId) return;
    if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socketId);
}

function _unregisterUserSocket(userId, socketId) {
    if (!userId || !userSockets.has(userId)) return;
    const set = userSockets.get(userId);
    set.delete(socketId);
    if (set.size === 0) userSockets.delete(userId);
}

function registerSocketHandlers(io) {
    const Kernel = require("../core/Kernel");
    const eventBus = Kernel.get("eventBus");

    // Listen for proactive notifications (like Scheduler).
    // Only the task's owner should see it - never a global broadcast,
    // since schedules/reminders are now per-user (see scheduleService.js).
    eventBus.on("scheduler:trigger", (data) => {
        const ownerId = data.ownerId;
        const targetSocketIds = ownerId ? userSockets.get(ownerId) : null;
        if (!targetSocketIds || targetSocketIds.size === 0) {
            // Owner not currently connected - nothing to deliver right now.
            return;
        }
        for (const socketId of targetSocketIds) {
            io.to(socketId).emit(Events.MESSAGE_REPLY, {
                id: data.taskId,
                role: "yuna",
                content: `⏰ **Reminder Triggered!**\n\n${data.message}`,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Bridge VoiceService's speech events to the owning user's socket(s) only.
    // VoiceService itself has no notion of sockets - it just emits {..., ownerId}
    // (ownerId is the authenticated userId, injected in AIOrchestrator - see
    // voiceService.js/AIOrchestrator.js). Registered once, module-level, so it
    // isn't re-subscribed per connection (that would leak a listener per client).
    const voiceService = require("../services/voiceService");

    const _routeToOwner = (eventName) => (data) => {
        const targetSocketIds = data.ownerId ? userSockets.get(data.ownerId) : null;
        if (!targetSocketIds || targetSocketIds.size === 0) return;
        const { ownerId, ...payload } = data;
        for (const socketId of targetSocketIds) {
            io.to(socketId).emit(eventName, payload);
        }
    };

    voiceService.on("voice:start", _routeToOwner(Events.VOICE_START));
    voiceService.on("voice:audio", _routeToOwner(Events.VOICE_CHUNK));
    voiceService.on("voice:end", _routeToOwner(Events.VOICE_END));
    voiceService.on("voice:error", _routeToOwner(Events.VOICE_ERROR));

    // Same owner-routing for image generation results (ImageGenerationCapability).
    const imageCapability = require("../capabilities/ImageGenerationCapability");
    if (imageCapability.eventBus) {
        imageCapability.eventBus.on("image:start", _routeToOwner(Events.IMAGE_START));
        imageCapability.eventBus.on("image:result", _routeToOwner(Events.IMAGE_RESULT));
        imageCapability.eventBus.on("image:error", _routeToOwner(Events.IMAGE_ERROR));
    }

    io.on("connection", (socket) => {
        const userId = socket.data && socket.data.user && socket.data.user.id;
        _registerUserSocket(userId, socket.id);

        console.log("=================================");
        console.log("🟢 New Client Connected");
        console.log(`Socket ID : ${socket.id}`);
        console.log("=================================");

        socket.emit(
            Events.CONNECTION_READY,
            {
                ok: true,
                socketId: socket.id,
                time: new Date().toISOString()
            }
        );

        socket.on(
            Events.MESSAGE_SEND,
            async payload => {
                try {
                    await handleChatMessage(
                        socket,
                        payload
                    );
                }
                catch (error) {
                    console.error(error);
                    socket.emit(

                        Events.MESSAGE_ERROR,

                        {

                            message: error.message

                        }

                    );

                }

            }

        );

        // Previously defined but never listened to anywhere - there was
        // no way to actually cancel an in-flight generation. See
        // chatController.cancelStream().
        socket.on(Events.STREAM_CANCEL, () => {
            if (!userId) return;
            cancelStream(userId);
        });

        socket.on('VISION_PROCESS', async (payload) => {
            try {
                if (!userId) {
                    socket.emit(Events.MESSAGE_ERROR, { message: "Not authenticated." });
                    return;
                }
                const visionService = require('../services/visionService');
                const memory = await visionService.processImage(userId, payload.image, payload.source);
                socket.emit('VISION_RESULT', memory);
            } catch (error) {
                console.error("Vision process error:", error);
                socket.emit(Events.MESSAGE_ERROR, { message: "Vision processing failed." });
            }
        });

        // Direct entry point for image generation - deliberately independent
        // of the AI intent-detection/planning pipeline (which has separate,
        // pre-existing gaps for multi-step tool dispatch beyond this phase's
        // scope - see audit notes). Identity is always socket.data.user.id,
        // never anything from the payload.
        socket.on("IMAGE_GENERATE", async (payload) => {
            if (!userId) {
                socket.emit(Events.IMAGE_ERROR, { message: "Not authenticated." });
                return;
            }
            const prompt = payload && payload.prompt;
            const imageCapability = require("../capabilities/ImageGenerationCapability");
            const result = await imageCapability.generate(userId, prompt);
            if (!result.success) {
                // Immediate rejections (rate limit, duplicate in-flight, empty
                // prompt, provider error) are returned synchronously here -
                // the image:start/result/error eventBus emissions (bridged
                // above) only fire once an actual generation attempt begins.
                socket.emit(Events.IMAGE_ERROR, { message: result.message });
            }
        });

        socket.on("disconnect", (reason) => {
            _unregisterUserSocket(userId, socket.id);
            console.log("=================================");
            console.log("🔴 Client Disconnected");
            console.log(`Socket ID : ${socket.id}`);
            console.log(`Reason : ${reason}`);
            console.log("=================================");
        });
    });
}

module.exports = {
    registerSocketHandlers,
};