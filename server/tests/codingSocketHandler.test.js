const test = require("node:test");
const assert = require("node:assert/strict");

const Kernel = require("../core/Kernel");

// socketHandler.js transitively requires voiceService -> ttsService (and a
// few more) at module-load time, each of which does Kernel.get(...) on
// registration-time module load. Register the same bindings bootstrap.js
// does (guarded, since a previous test file in the same `node --test` run
// may already have done this) so requiring socketHandler.js here reflects
// how the real app actually boots, not a hand-picked subset.
if (!Kernel.has("eventBus")) {
    Kernel.register("eventBus", require("../core/EventBus"));
    Kernel.register("moduleRegistry", require("../core/ModuleRegistry"));
    Kernel.register("capabilityRegistry", require("../core/CapabilityRegistry"));
    Kernel.register("pluginLoader", require("../core/PluginLoader"));
    Kernel.register("pluginManager", new (require("../core/PluginManager"))(Kernel));
    Kernel.register("stateMachine", require("../core/StateMachine"));
    Kernel.register("settingsFileStore", new (require("../infrastructure/SettingsFileStore"))());
    Kernel.register("sessionStore", new (require("../infrastructure/SessionStore"))());
    Kernel.register("memoryRepository", new (require("../infrastructure/FileMemoryRepository"))());
    Kernel.register("userRepository", new (require("../infrastructure/FileUserRepository"))());
    if (!process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = "test-only-placeholder-not-a-real-key";
    Kernel.register("providerManager", require("../providers/ProviderManager"));
    const { AuthService } = require("../services/authService");
    Kernel.register("authService", new AuthService(Kernel));
    const { SettingsService } = require("../services/settingsService");
    Kernel.register("settingsService", SettingsService);
    const { ConversationService } = require("../services/conversationService");
    Kernel.register("conversationService", ConversationService);
    const { MemoryService } = require("../services/memoryService");
    Kernel.register("memoryService", MemoryService);
    const { ContextService } = require("../services/contextService");
    Kernel.register("contextService", ContextService);
    Kernel.register("emotionEngine", require("../services/EmotionEngine"));
    Kernel.register("personalityEngine", new (require("../services/PersonalityEngine"))(Kernel));
    const { TTSService } = require("../services/ttsService");
    Kernel.register("ttsService", TTSService);
    Kernel.register("permissionService", require("../services/permissionService"));
    Kernel.register("voiceService", require("../services/voiceService"));
    Kernel.register("streamService", require("../services/streamService"));
    const { PromptBuilder } = require("../services/promptBuilder");
    Kernel.register("promptBuilder", PromptBuilder);
    Kernel.register("intentDetector", require("../services/intentDetector"));
    Kernel.register("taskPlanner", require("../services/taskPlanner"));
    Kernel.register("sharedContext", new (require("../core/SharedContext"))());
    Kernel.register("agentCoordinator", new (require("../core/AgentCoordinator"))(Kernel));
    const { AIOrchestrator } = require("../services/AIOrchestrator");
    Kernel.register("aiOrchestrator", new AIOrchestrator(Kernel));
}

const { registerSocketHandlers } = require("../socket/socketHandler");
const Events = require("../socket/socketEvents");

/** Minimal fake socket.io server/socket pair - just enough surface for
 * registerSocketHandlers to drive: io.on("connection"), io.to(id).emit,
 * socket.on/emit/id/data. */
function makeFakeIo() {
    const sockets = new Map(); // id -> fakeSocket
    let connectionHandler = null;
    const io = {
        on(event, handler) { if (event === "connection") connectionHandler = handler; },
        to(socketId) {
            return { emit: (event, payload) => sockets.get(socketId)?.received.push({ event, payload }) };
        }
    };
    function connect(userId, socketId) {
        const handlers = {};
        const socket = {
            id: socketId,
            data: { user: userId ? { id: userId } : null },
            received: [],
            on(event, handler) { handlers[event] = handler; },
            emit(event, payload) { socket.received.push({ event, payload }); },
            _trigger(event, payload, callback) { return handlers[event]?.(payload, callback); }
        };
        sockets.set(socketId, socket);
        connectionHandler(socket);
        return socket;
    }
    return { io, connect };
}

test("socketHandler: coding:* eventBus activity is routed only to the owning user's socket", () => {
    const { io, connect } = makeFakeIo();
    registerSocketHandlers(io);

    const ownerSocket = connect("userA", "socketA1");
    const otherSocket = connect("userB", "socketB1");

    const eventBus = Kernel.get("eventBus");
    eventBus.emit("coding:tool:result", { ownerId: "userA", sessionId: "s1", tool: "file_read", success: true });

    const delivered = ownerSocket.received.find((r) => r.event === Events.CODING_TOOL_RESULT);
    assert.ok(delivered, "owner should have received the event");
    assert.equal(delivered.payload.tool, "file_read");
    // ownerId itself is stripped before delivery - the client already knows who it is.
    assert.equal(delivered.payload.ownerId, undefined);

    const leaked = otherSocket.received.find((r) => r.event === Events.CODING_TOOL_RESULT);
    assert.equal(leaked, undefined, "a different user must never see another user's coding activity");
});

test("socketHandler: CODING_AGENT_RUN rejects unauthenticated sockets without touching the capability", async () => {
    const { io, connect } = makeFakeIo();
    registerSocketHandlers(io);
    const socket = connect(null, "anon1");

    const codingCapability = require("../capabilities/CodingWorkspaceCapability");
    let called = false;
    const original = codingCapability.execute;
    codingCapability.execute = async () => { called = true; return { success: true }; };

    try {
        await socket._trigger("CODING_AGENT_RUN", { task: "do something", provider: "gemini" });
        assert.equal(called, false);
        const err = socket.received.find((r) => r.event === Events.CODING_AGENT_ERROR);
        assert.ok(err, "expected an authentication error to be emitted");
    } finally {
        codingCapability.execute = original;
    }
});

test("socketHandler: CODING_AGENT_RUN passes the socket's authenticated userId as __ownerId, never a client-supplied one", async () => {
    const { io, connect } = makeFakeIo();
    registerSocketHandlers(io);
    const socket = connect("realUser", "s2");

    const codingCapability = require("../capabilities/CodingWorkspaceCapability");
    let capturedInput = null;
    const original = codingCapability.execute;
    codingCapability.execute = async (input) => { capturedInput = input; return { success: true, state: "COMPLETED" }; };

    try {
        await socket._trigger("CODING_AGENT_RUN", {
            task: "refactor the login page",
            provider: "gemini",
            // A malicious/buggy client trying to smuggle a different owner -
            // must be ignored entirely, since __ownerId only ever comes from
            // socket.data.user.id in socketHandler itself.
            __ownerId: "someoneElse"
        });
    } finally {
        codingCapability.execute = original;
    }

    assert.ok(capturedInput);
    assert.equal(capturedInput.action, "agent.run");
    assert.equal(capturedInput.__ownerId, "realUser");
    assert.equal(capturedInput.params.task, "refactor the login page");
    assert.equal(capturedInput.params.provider, "gemini");
});

test("socketHandler: CODING_AGENT_CANCEL forwards sessionId with the authenticated ownerId", async () => {
    const { io, connect } = makeFakeIo();
    registerSocketHandlers(io);
    const socket = connect("realUser", "s3");

    const codingCapability = require("../capabilities/CodingWorkspaceCapability");
    let capturedInput = null;
    const original = codingCapability.execute;
    codingCapability.execute = async (input) => { capturedInput = input; return { success: true, cancelled: true }; };

    try {
        await socket._trigger("CODING_AGENT_CANCEL", { sessionId: "session-123" });
    } finally {
        codingCapability.execute = original;
    }

    assert.equal(capturedInput.action, "agent.cancel");
    assert.equal(capturedInput.__ownerId, "realUser");
    assert.equal(capturedInput.params.sessionId, "session-123");
});

test("socketHandler: CODING_CAPABILITY_ACTION rejects unauthenticated sockets via the ack callback, without touching the capability", async () => {
    const { io, connect } = makeFakeIo();
    registerSocketHandlers(io);
    const socket = connect(null, "anon2");

    const codingCapability = require("../capabilities/CodingWorkspaceCapability");
    let called = false;
    const original = codingCapability.execute;
    codingCapability.execute = async () => { called = true; return { success: true }; };

    try {
        const response = await new Promise((resolve) => {
            socket._trigger("CODING_CAPABILITY_ACTION", { action: "workspace.list", params: {} }, resolve);
        });
        assert.equal(called, false);
        assert.equal(response.success, false);
        assert.match(response.message, /Not authenticated/);
    } finally {
        codingCapability.execute = original;
    }
});

test("socketHandler: CODING_CAPABILITY_ACTION refuses an action outside the whitelist (e.g. agent.run must use its own dedicated event)", async () => {
    const { io, connect } = makeFakeIo();
    registerSocketHandlers(io);
    const socket = connect("realUser", "s4");

    const codingCapability = require("../capabilities/CodingWorkspaceCapability");
    let called = false;
    const original = codingCapability.execute;
    codingCapability.execute = async () => { called = true; return { success: true }; };

    try {
        const response = await new Promise((resolve) => {
            socket._trigger("CODING_CAPABILITY_ACTION", { action: "agent.run", params: { task: "sneaky" } }, resolve);
        });
        assert.equal(called, false);
        assert.equal(response.success, false);
        assert.match(response.message, /not permitted/i);
    } finally {
        codingCapability.execute = original;
    }
});

test("socketHandler: CODING_CAPABILITY_ACTION dispatches a whitelisted action with the authenticated userId, never a client-supplied one, and returns the real result via ack", async () => {
    const { io, connect } = makeFakeIo();
    registerSocketHandlers(io);
    const socket = connect("realUser", "s5");

    const codingCapability = require("../capabilities/CodingWorkspaceCapability");
    let capturedInput = null;
    const original = codingCapability.execute;
    codingCapability.execute = async (input) => { capturedInput = input; return { success: true, entries: [{ name: "index.js", type: "file" }] }; };

    try {
        const response = await new Promise((resolve) => {
            socket._trigger("CODING_CAPABILITY_ACTION", {
                action: "workspace.list",
                params: { path: ".", __ownerId: "someoneElse" }
            }, resolve);
        });
        assert.equal(capturedInput.action, "workspace.list");
        assert.equal(capturedInput.__ownerId, "realUser");
        assert.equal(capturedInput.params.__ownerId, "someoneElse"); // present in params, but never read as the owner
        assert.equal(response.success, true);
        assert.deepEqual(response.entries, [{ name: "index.js", type: "file" }]);
    } finally {
        codingCapability.execute = original;
    }
});

test("socketHandler: CODING_CAPABILITY_ACTION never hangs the client's ack even if the capability throws unexpectedly", async () => {
    const { io, connect } = makeFakeIo();
    registerSocketHandlers(io);
    const socket = connect("realUser", "s6");

    const codingCapability = require("../capabilities/CodingWorkspaceCapability");
    const original = codingCapability.execute;
    codingCapability.execute = async () => { throw new Error("boom - something truly unexpected"); };

    try {
        const response = await new Promise((resolve) => {
            socket._trigger("CODING_CAPABILITY_ACTION", { action: "git.status", params: {} }, resolve);
        });
        assert.equal(response.success, false);
        // Generic message only - never the raw thrown error text, which
        // could in principle contain something sensitive from deep in the
        // stack.
        assert.doesNotMatch(response.message, /boom/);
    } finally {
        codingCapability.execute = original;
    }
});

test("socketHandler: CODING_TERMINAL_RUN_STARTED fires with a real runId for a manually-triggered terminal.run, before the ack resolves", async () => {
    const { io, connect } = makeFakeIo();
    registerSocketHandlers(io);
    const socket = connect("realUser", "s8");

    const codingCapability = require("../capabilities/CodingWorkspaceCapability");
    const original = codingCapability.execute;
    codingCapability.execute = async (input) => {
        // Simulate CodingTerminalService actually starting the process
        // before the whole command finishes - onStart must fire here,
        // synchronously from the capability's perspective, same as the
        // real terminal service does.
        input.params.onStart?.("run-abc-123");
        return { success: true, exitCode: 0, stdout: "ok", stderr: "" };
    };

    try {
        const response = await new Promise((resolve) => {
            socket._trigger("CODING_CAPABILITY_ACTION", { action: "terminal.run", params: { command: "echo hi" } }, resolve);
        });
        assert.equal(response.success, true);
    } finally {
        codingCapability.execute = original;
    }

    const startedEvent = socket.received.find((r) => r.event === "CODING_TERMINAL_RUN_STARTED");
    assert.ok(startedEvent, "expected a real-time run-started event");
    assert.equal(startedEvent.payload.runId, "run-abc-123");
});

test("socketHandler: CODING_AGENT_RESUME passes sessionId/approved/approvalId with the authenticated ownerId", async () => {
    const { io, connect } = makeFakeIo();
    registerSocketHandlers(io);
    const socket = connect("realUser", "s7");

    const codingCapability = require("../capabilities/CodingWorkspaceCapability");
    let capturedInput = null;
    const original = codingCapability.execute;
    codingCapability.execute = async (input) => { capturedInput = input; return { success: true, state: "COMPLETED" }; };

    try {
        await socket._trigger("CODING_AGENT_RESUME", { sessionId: "sess-1", approved: true, approvalId: "appr-1" });
    } finally {
        codingCapability.execute = original;
    }

    assert.equal(capturedInput.action, "agent.resume");
    assert.equal(capturedInput.__ownerId, "realUser");
    assert.equal(capturedInput.params.sessionId, "sess-1");
    assert.equal(capturedInput.params.approved, true);
    assert.equal(capturedInput.params.approvalId, "appr-1");
});
