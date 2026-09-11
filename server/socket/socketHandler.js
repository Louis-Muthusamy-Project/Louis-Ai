const { handleChatMessage, cancelStream } = require("../controllers/chatController");
const Events = require("./socketEvents");
const { userHasFeature } = require("../middleware/featureMiddleware");

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

    // Coding agent activity - CodingAgentRuntime emits onto the shared
    // Kernel eventBus (wired in CodingWorkspaceCapability.initialize), each
    // payload carrying { ownerId, sessionId, ... }. Routed the same way as
    // image:*/voice:* - only the owning user's connected socket(s) ever see
    // their own coding session's activity.
    eventBus.on("coding:session:start", _routeToOwner(Events.CODING_SESSION_START));
    eventBus.on("coding:agent:thinking", _routeToOwner(Events.CODING_AGENT_THINKING));
    eventBus.on("coding:tool:start", _routeToOwner(Events.CODING_TOOL_START));
    eventBus.on("coding:tool:result", _routeToOwner(Events.CODING_TOOL_RESULT));
    eventBus.on("coding:file:changed", _routeToOwner(Events.CODING_FILE_CHANGED));
    eventBus.on("coding:terminal:start", _routeToOwner(Events.CODING_TERMINAL_START));
    eventBus.on("coding:terminal:output", _routeToOwner(Events.CODING_TERMINAL_OUTPUT));
    eventBus.on("coding:terminal:complete", _routeToOwner(Events.CODING_TERMINAL_COMPLETE));
    eventBus.on("coding:approval:required", _routeToOwner(Events.CODING_APPROVAL_REQUIRED));
    eventBus.on("coding:agent:complete", _routeToOwner(Events.CODING_AGENT_COMPLETE));
    eventBus.on("coding:agent:error", _routeToOwner(Events.CODING_AGENT_ERROR));
    eventBus.on("coding:agent:cancelled", _routeToOwner(Events.CODING_AGENT_CANCELLED));

    io.on("connection", (socket) => {
        const userId = socket.data && socket.data.user && socket.data.user.id;
        const user = socket.data && socket.data.user;
        _registerUserSocket(userId, socket.id);

        /**
         * Backend enforcement of Part 9 (Module Access Model) at the
         * Socket.IO layer - mirrors requireFeature() for HTTP routes.
         * Hiding a disabled tab on the frontend is UX only; this is what
         * actually stops a manually-sent event for a disabled module.
         */
        const requireFeatureSocket = (featureName, errorEvent, message) => {
            if (userHasFeature(user, featureName)) return true;
            socket.emit(errorEvent, {
                message: message || `The "${featureName}" feature is disabled for this account.`,
                code: "FEATURE_DISABLED"
            });
            return false;
        };

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
                if (!requireFeatureSocket("chat", Events.MESSAGE_ERROR)) return;
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
            if (!requireFeatureSocket("chat", Events.MESSAGE_ERROR)) return;
            cancelStream(userId);
        });

        socket.on('VISION_PROCESS', async (payload) => {
            try {
                if (!userId) {
                    socket.emit(Events.MESSAGE_ERROR, { message: "Not authenticated." });
                    return;
                }
                if (!requireFeatureSocket("character", Events.MESSAGE_ERROR)) return;
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
            if (!requireFeatureSocket("chat", Events.IMAGE_ERROR)) return;
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

        socket.on("CODING_PROVIDERS_LIST", async () => {
            if (!userId) return;
            if (!requireFeatureSocket("coding", Events.CODING_AGENT_ERROR)) return;
            const codingCapability = require("../capabilities/CodingWorkspaceCapability");
            const result = await codingCapability.execute({ action: "agent.providers", params: {}, __ownerId: userId });
            socket.emit("CODING_PROVIDERS_RESULT", result);
        });

        socket.on("CODING_AGENT_RUN", async (payload) => {
            if (!userId) {
                socket.emit(Events.CODING_AGENT_ERROR, { message: "Not authenticated." });
                return;
            }
            if (!requireFeatureSocket("coding", Events.CODING_AGENT_ERROR)) return;
            const codingCapability = require("../capabilities/CodingWorkspaceCapability");
            // agent.run resolves only once the WHOLE run finishes/pauses/is
            // cancelled/hits a limit - progress is observed via the
            // CODING_* activity events routed above, not this response.
            const result = await codingCapability.execute({
                action: "agent.run",
                params: {
                    task: payload && payload.task,
                    provider: payload && payload.provider,
                    maxIterations: payload && payload.maxIterations,
                    maxToolCalls: payload && payload.maxToolCalls,
                    maxRuntimeMs: payload && payload.maxRuntimeMs
                },
                __ownerId: userId
            });
            if (!result.success) {
                socket.emit(Events.CODING_AGENT_ERROR, { message: result.message });
            }
        });

        socket.on("CODING_AGENT_CANCEL", async (payload) => {
            if (!userId) return;
            if (!requireFeatureSocket("coding", Events.CODING_AGENT_ERROR)) return;
            const codingCapability = require("../capabilities/CodingWorkspaceCapability");
            // sessionId is opaque and only ever meaningful in the context of
            // the run that emitted it to this same authenticated user via
            // CODING_SESSION_START above - cancel() itself only accepts a
            // sessionId, never a userId, so there's nothing here for one
            // user to target another user's session with even if they
            // guessed an id.
            await codingCapability.execute({ action: "agent.cancel", params: { sessionId: payload && payload.sessionId }, __ownerId: userId });
        });

        socket.on("CODING_AGENT_RESUME", async (payload) => {
            if (!userId) {
                socket.emit(Events.CODING_AGENT_ERROR, { message: "Not authenticated." });
                return;
            }
            if (!requireFeatureSocket("coding", Events.CODING_AGENT_ERROR)) return;
            const codingCapability = require("../capabilities/CodingWorkspaceCapability");
            // Resolves once the resumed run finishes/pauses again/hits a
            // limit - same "watch the CODING_* events, not this response"
            // shape as CODING_AGENT_RUN. approvalId is required and
            // re-validated server-side (see CodingAgentRuntime.resume) -
            // a client cannot approve a stale or someone else's request
            // merely by supplying a sessionId.
            const result = await codingCapability.execute({
                action: "agent.resume",
                params: {
                    sessionId: payload && payload.sessionId,
                    approved: payload && payload.approved,
                    approvalId: payload && payload.approvalId
                },
                __ownerId: userId
            });
            if (!result.success) {
                socket.emit(Events.CODING_AGENT_ERROR, { message: result.message });
            }
        });

        // Whitelisted, quick request/response coding actions - workspace
        // browsing, file CRUD, terminal, git, and session listing. Uses a
        // socket.io ack callback (request/response) rather than the
        // fire-and-forget + eventBus-stream shape above, since these
        // actions complete in one round trip and the UI needs their
        // result directly, not via a separate activity event. Deliberately
        // excludes agent.run/agent.cancel/agent.resume, which have their
        // own dedicated handlers above with genuinely different
        // (long-running, streamed) semantics.
        const CODING_CAPABILITY_ACTIONS = new Set([
            "workspace.inspect", "workspace.setRoot", "workspace.list", "workspace.search",
            "file.read", "file.write", "file.create", "file.delete", "file.rename",
            "terminal.run", "terminal.cancel",
            "git.status", "git.diff", "git.log", "git.stage", "git.unstage", "git.commit", "git.branch",
            "agent.providers", "agent.sessions.list", "agent.sessions.get"
        ]);

        socket.on("CODING_CAPABILITY_ACTION", async (payload, callback) => {
            const respond = typeof callback === "function" ? callback : () => {};
            if (!userId) {
                respond({ success: false, message: "Not authenticated." });
                return;
            }
            if (!userHasFeature(user, "coding")) {
                respond({ success: false, message: "The \"coding\" feature is disabled for this account.", code: "FEATURE_DISABLED" });
                return;
            }
            const action = payload && payload.action;
            if (!CODING_CAPABILITY_ACTIONS.has(action)) {
                respond({ success: false, message: `Action not permitted on this channel: ${action}` });
                return;
            }
            const codingCapability = require("../capabilities/CodingWorkspaceCapability");
            try {
                const params = { ...((payload && payload.params) || {}) };
                if (action === "terminal.run") {
                    // Real-time runId so the client can actually cancel this
                    // specific command while it's still running - the ack
                    // callback below only resolves once the command
                    // finishes, which is too late for Cancel to do anything.
                    params.onStart = (runId) => {
                        socket.emit("CODING_TERMINAL_RUN_STARTED", { runId });
                    };
                }
                const result = await codingCapability.execute({
                    action,
                    params,
                    __ownerId: userId
                });
                respond(result);
            } catch (error) {
                // Defense in depth - execute() already catches its own
                // known error types, but never let an unexpected throw
                // leave the client's ack callback hanging forever.
                respond({ success: false, message: "An unexpected error occurred." });
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