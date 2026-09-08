const crypto = require("crypto");

const capability = require("../../capabilities/CodingWorkspaceCapability");
const { CodingTerminalService } = require("../codingTerminalService");
const { CODING_TOOLS, CODING_TOOL_TO_CAPABILITY_ACTION, FILE_MUTATING_TOOLS, TERMINAL_TOOLS } = require("./codingToolDefinitions");
const { toSessionRecord } = require("../../infrastructure/codingSessionRecord");

/**
 * ==========================================
 * CodingAgentRuntime
 * ------------------------------------------
 * USER TASK -> selected CodingModelProvider -> model requests a tool ->
 * Yuna executes it for real via CodingWorkspaceCapability -> the result
 * goes back to the SAME model -> model reasons again -> repeat -> until
 * the model returns a final answer with no more tool calls, a safety
 * limit is hit, the run is cancelled, or a destructive/secret action
 * needs human approval.
 *
 * This is intentionally the ONLY place that owns the loop - run() and
 * resume() both funnel into the same private _loop()/_executeToolCall(),
 * so approving a paused action continues the SAME conversation rather
 * than re-implementing agent logic a second time.
 *
 * Persistence (optional): if initialize() is given a sessionService, every
 * meaningful state change is saved as a plain JSON record (see
 * infrastructure/codingSessionRecord.js) - including the full opaque
 * provider history, which is genuinely JSON-safe for all three adapters.
 * This is what makes resume() work even after a server restart: a session
 * not found in this process's in-memory _sessions map is reconstructed
 * from its persisted record, and the provider is rebuilt by name via
 * providerRegistry rather than needing to be passed back in.
 * ==========================================
 */

const STATES = Object.freeze({
    IDLE: "IDLE",
    RUNNING: "RUNNING",
    WAITING_FOR_APPROVAL: "WAITING_FOR_APPROVAL",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
    LIMIT_REACHED: "LIMIT_REACHED"
});

const DEFAULT_MAX_ITERATIONS = 15;   // model turns
const DEFAULT_MAX_TOOL_CALLS = 40;   // total tool executions across the whole run
const DEFAULT_MAX_RUNTIME_MS = 5 * 60_000;

const SYSTEM_INSTRUCTION = `You are Yuna's coding agent, operating on the user's real project files inside a
sandboxed workspace. You have real tools - when you call one, it actually
reads/writes files, actually runs terminal commands, and actually inspects
git. There is no "proposed" mode: if the user asked you to make a change,
call file_write (or the appropriate tool) and it will really happen.

Work iteratively: inspect before you edit (workspace_inspect / workspace_list
/ workspace_search / file_read), make the smallest correct change, then
verify it (terminal_run / test_run) before declaring the task done. If a
command fails, read the actual output, form a hypothesis, and try again -
don't guess blindly and don't declare success without verifying.

Never touch a file outside the workspace, and never read a secret-looking
file (.env, private keys, credentials) unless the task specifically and
unavoidably requires it. Never push, force-push, or run
"git reset --hard"/"git clean" - those tools are not available to you at
all. Only commit when the user has clearly asked for it.

When you are done, or when you cannot proceed further, respond with plain
text summarizing exactly what you changed, what you ran, and the result -
do not call any more tools once you're giving your final answer.`;

class CodingAgentSession {
    constructor(sessionId, userId, providerName, task) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.providerName = providerName;
        this.task = task;
        this.state = STATES.IDLE;
        this.cancelled = false;
        this.iterations = 0;
        this.toolCalls = 0;
        this.startedAt = Date.now();
        this.changedFiles = new Set();
        this.pendingApproval = null; // { approvalId, call, reason, message } when WAITING_FOR_APPROVAL
        this.lastRunId = null; // last CodingTerminalService runId, for cancel()
        this.activity = []; // structured log, capped
        this.history = null; // opaque provider-native conversation state
        this.provider = null; // live provider instance, not persisted
        this.finalText = "";
        this.message = "";
        this.maxIterations = DEFAULT_MAX_ITERATIONS;
        this.maxToolCalls = DEFAULT_MAX_TOOL_CALLS;
        this.maxRuntimeMs = DEFAULT_MAX_RUNTIME_MS;
    }
}

class CodingAgentRuntime {
    constructor() {
        /** @type {Map<string, CodingAgentSession>} */
        this._sessions = new Map();
        this.eventBus = null; // wired via initialize(), mirrors ImageGenerationCapability
        this.sessionService = null; // optional - CodingSessionService, ownership-enforcing
        this.providerRegistry = null; // optional but required for resume() after a restart
    }

    initialize(eventBus, { sessionService, providerRegistry } = {}) {
        this.eventBus = eventBus;
        this.sessionService = sessionService || null;
        this.providerRegistry = providerRegistry || null;
    }

    _emit(session, eventName, payload = {}) {
        session.activity.push({ event: eventName, at: Date.now(), ...payload });
        if (session.activity.length > 500) session.activity.shift();
        if (this.eventBus) {
            this.eventBus.emit(eventName, { ownerId: session.userId, sessionId: session.sessionId, ...payload });
        }
    }

    async _persist(session) {
        if (!this.sessionService) return;
        try {
            const record = toSessionRecord(session, session.history);
            record.maxIterations = session.maxIterations;
            record.maxToolCalls = session.maxToolCalls;
            record.maxRuntimeMs = session.maxRuntimeMs;
            await this.sessionService.save(record);
        } catch (error) {
            // Persistence is best-effort - a save failure should never
            // crash or pause an otherwise-healthy agent run.
            console.warn("[CodingAgentRuntime] Failed to persist session:", error.message);
        }
    }

    /** Cancels a running session. Safe to call for an unknown/finished id. */
    cancel(sessionId) {
        const session = this._sessions.get(sessionId);
        if (!session) return false;
        if (session.state !== STATES.RUNNING) return false;
        session.cancelled = true;
        if (session.lastRunId) {
            CodingTerminalService.cancel(session.lastRunId);
        }
        return true;
    }

    getSession(sessionId) {
        return this._sessions.get(sessionId) || null;
    }

    /**
     * Runs a coding task to completion (or until blocked/limited/cancelled).
     * @param {string} userId authenticated user id - never client-supplied
     * @param {string} taskText the user's task instruction
     * @param {import('./CodingModelProvider')} provider
     * @param {object} [options]
     * @returns {Promise<{sessionId, state, text, changedFiles: string[], iterations, toolCalls}>}
     */
    async run(userId, taskText, provider, options = {}) {
        if (!userId) throw new Error("CodingAgentRuntime.run requires an authenticated userId.");
        if (!taskText || !taskText.trim()) throw new Error("A task is required.");
        if (!provider || typeof provider.isConfigured !== "function") {
            throw new Error("A valid CodingModelProvider instance is required.");
        }
        if (!provider.isConfigured()) {
            throw new Error(`Provider "${provider.getName?.() || "unknown"}" is not configured (missing API key).`);
        }

        const sessionId = crypto.randomUUID();
        const session = new CodingAgentSession(sessionId, userId, provider.getName(), taskText);
        session.state = STATES.RUNNING;
        session.maxIterations = options.maxIterations || DEFAULT_MAX_ITERATIONS;
        session.maxToolCalls = options.maxToolCalls || DEFAULT_MAX_TOOL_CALLS;
        session.maxRuntimeMs = options.maxRuntimeMs || DEFAULT_MAX_RUNTIME_MS;
        session.provider = provider;
        session.history = provider.buildInitialHistory(taskText, SYSTEM_INSTRUCTION);
        this._sessions.set(sessionId, session);

        this._emit(session, "coding:session:start", { task: taskText, provider: provider.getName() });
        await this._persist(session);

        return this._loop(session, provider);
    }

    /**
     * Resumes a session that's WAITING_FOR_APPROVAL - either still live in
     * this process, or reconstructed from a persisted record (e.g. after a
     * server restart). Re-executes exactly the one pending tool call (now
     * confirmed) and continues the SAME loop with the SAME history, since
     * the model never received a result for that call yet.
     *
     * @param {string} userId authenticated user id - must own the session
     * @param {string} sessionId
     * @param {{approved: boolean, approvalId: string}} decision
     *   approvalId must match the pending approval exactly - this is what
     *   prevents a stale/replayed approval decision (e.g. a second click,
     *   or an old request replayed) from resolving a DIFFERENT pending
     *   approval that happened to reuse the same sessionId later.
     */
    async resume(userId, sessionId, { approved, approvalId } = {}) {
        if (!userId) throw new Error("CodingAgentRuntime.resume requires an authenticated userId.");

        let session = this._sessions.get(sessionId);
        if (session && session.userId !== userId) {
            // Never reveal that a session with this id exists for someone
            // else - same error as "not found" below.
            session = null;
        }
        if (!session) {
            session = await this._reconstructSession(userId, sessionId);
        }
        if (!session) {
            throw new Error("No session found with that id.");
        }
        if (session.state !== STATES.WAITING_FOR_APPROVAL || !session.pendingApproval) {
            throw new Error("This session is not waiting for approval.");
        }
        if (!approvalId || approvalId !== session.pendingApproval.approvalId) {
            throw new Error("Stale or invalid approval id - this approval may already have been resolved.");
        }

        const pending = session.pendingApproval;
        // Consumed immediately - a second resume() call with the same
        // approvalId (a replay) now has nothing left to match against,
        // even if this call is somehow still in flight when it arrives.
        session.pendingApproval = null;

        if (!approved) {
            this._emit(session, "coding:agent:cancelled", { reason: "Pending action denied by user." });
            return this._finish(session, STATES.CANCELLED, "Pending action denied by user.");
        }

        const provider = session.provider || this._rebuildProvider(session.providerName);
        session.provider = provider;
        session.state = STATES.RUNNING;

        const extraParams = pending.reason === "SECRET_FILE_BLOCKED"
            ? { acknowledgeSecret: true }
            : { confirmed: true };

        const { blocked, result } = await this._executeToolCall(session, provider, pending.call, extraParams);
        if (blocked) {
            // Extremely unlikely (an approved action immediately re-blocks
            // for a different reason), but handled safely rather than
            // assumed impossible.
            await this._persist(session);
            return this._snapshot(session);
        }

        session.history = provider.appendFunctionResultsTurn(session.history, [{ call: pending.call, result }]);
        await this._persist(session);

        return this._loop(session, provider);
    }

    _rebuildProvider(providerName) {
        if (!this.providerRegistry) {
            throw new Error("Cannot resume this session: no provider registry is configured on this runtime instance (likely a fresh process with no prior in-memory session).");
        }
        return this.providerRegistry.getCodingProvider(providerName);
    }

    async _reconstructSession(userId, sessionId) {
        if (!this.sessionService) return null;
        const record = await this.sessionService.getOwned(userId, sessionId);
        if (!record) return null;

        const session = new CodingAgentSession(record.sessionId, record.userId, record.providerName, record.task);
        session.state = record.state;
        session.history = record.history;
        session.finalText = record.finalText || "";
        session.message = record.message || "";
        session.iterations = record.iterations || 0;
        session.toolCalls = record.toolCalls || 0;
        session.changedFiles = new Set(record.changedFiles || []);
        session.activity = record.activity || [];
        session.pendingApproval = record.pendingApproval || null;
        session.startedAt = record.startedAt || Date.now();
        session.maxIterations = record.maxIterations || DEFAULT_MAX_ITERATIONS;
        session.maxToolCalls = record.maxToolCalls || DEFAULT_MAX_TOOL_CALLS;
        session.maxRuntimeMs = record.maxRuntimeMs || DEFAULT_MAX_RUNTIME_MS;

        if (record.historyTooLarge) {
            throw new Error("This session's history was too large to persist in full and cannot be resumed - only fresh sessions can be started for this workspace/task now.");
        }

        this._sessions.set(session.sessionId, session);
        return session;
    }

    /** The main agent loop, shared by run() and resume()'s continuation. */
    async _loop(session, provider) {
        try {
            while (true) {
                if (session.cancelled) return this._finish(session, STATES.CANCELLED);
                if (Date.now() - session.startedAt > session.maxRuntimeMs) {
                    return this._finish(session, STATES.LIMIT_REACHED, "Agent stopped after reaching the maximum runtime limit.");
                }
                if (session.iterations >= session.maxIterations) {
                    return this._finish(session, STATES.LIMIT_REACHED, "Agent stopped after reaching the maximum iteration limit.");
                }

                session.iterations += 1;
                this._emit(session, "coding:agent:thinking", { iteration: session.iterations });

                const turn = await provider.sendTurn(session.history, CODING_TOOLS);
                session.history = provider.appendModelTurn(session.history, turn);
                if (turn.text) session.finalText = turn.text;

                if (!turn.functionCalls || turn.functionCalls.length === 0) {
                    return this._finish(session, STATES.COMPLETED);
                }

                const callsWithResults = [];
                for (const call of turn.functionCalls) {
                    if (session.cancelled) return this._finish(session, STATES.CANCELLED);
                    if (session.toolCalls >= session.maxToolCalls) {
                        return this._finish(session, STATES.LIMIT_REACHED, "Agent stopped after reaching the maximum tool-call limit.");
                    }

                    const { blocked, result } = await this._executeToolCall(session, provider, call);
                    if (blocked) {
                        await this._persist(session);
                        return this._snapshot(session);
                    }
                    callsWithResults.push({ call, result });
                }

                session.history = provider.appendFunctionResultsTurn(session.history, callsWithResults);
                await this._persist(session);
            }
        } catch (error) {
            this._emit(session, "coding:agent:error", { message: error.message });
            return this._finish(session, STATES.FAILED, error.message);
        }
    }

    /**
     * Executes exactly one tool call. Returns { blocked: true, result } if
     * the action was refused pending human approval (session is left in
     * WAITING_FOR_APPROVAL, already emitted/persisted) - the caller must
     * stop processing further calls in that turn when blocked is true.
     * `extraParams` is how resume() forces confirmed:true/acknowledgeSecret:true
     * onto the retried call without the model needing to re-request it.
     */
    async _executeToolCall(session, provider, call, extraParams = {}) {
        const mapping = CODING_TOOL_TO_CAPABILITY_ACTION[call.name];
        if (!mapping) {
            return { blocked: false, result: { success: false, message: `Unknown tool: ${call.name}` } };
        }

        session.toolCalls += 1;
        this._emit(session, "coding:tool:start", { tool: call.name, args: this._redactArgs(call.args) });

        if (TERMINAL_TOOLS.has(call.name)) {
            this._emit(session, "coding:terminal:start", { command: call.args.command });
        }

        const result = await capability.execute({
            action: mapping.action,
            params: {
                ...mapping.mapParams(call.args || {}),
                ...extraParams,
                ...(TERMINAL_TOOLS.has(call.name)
                    ? { onStart: (runId) => { session.lastRunId = runId; } }
                    : {})
            },
            __ownerId: session.userId
        });

        if (result && result.runId) session.lastRunId = result.runId;

        const alreadyConfirmed = !!(extraParams.confirmed || extraParams.acknowledgeSecret);
        if (!alreadyConfirmed && result && result.success === false
            && (result.code === "CONFIRMATION_REQUIRED" || result.code === "SECRET_FILE_BLOCKED")) {
            await this._pauseForApproval(session, call, result);
            return { blocked: true, result };
        }

        this._emit(session, "coding:tool:result", { tool: call.name, success: !!(result && result.success), summary: this._summarizeResult(call.name, result) });

        if (TERMINAL_TOOLS.has(call.name)) {
            this._emit(session, "coding:terminal:output", { stdout: result.stdout, stderr: result.stderr });
            this._emit(session, "coding:terminal:complete", { exitCode: result.exitCode, success: result.success, timedOut: result.timedOut });
        }

        if (FILE_MUTATING_TOOLS.has(call.name) && result && result.success) {
            const mappedParams = mapping.mapParams(call.args || {});
            const changedPath = mappedParams.path || mappedParams.to;
            if (changedPath) {
                session.changedFiles.add(changedPath);
                this._emit(session, "coding:file:changed", { path: changedPath, operation: call.name });
            }
        }

        return { blocked: false, result };
    }

    async _pauseForApproval(session, call, result) {
        const approvalId = crypto.randomUUID();
        session.pendingApproval = { approvalId, call, reason: result.code, message: result.message };
        session.state = STATES.WAITING_FOR_APPROVAL;
        this._emit(session, "coding:approval:required", {
            approvalId, tool: call.name, args: this._redactArgs(call.args), reason: result.code, message: result.message
        });
        await this._persist(session);
    }

    _finish(session, state, message) {
        session.state = state;
        session.message = message || session.finalText;
        this._sessions.set(session.sessionId, session);
        const eventName = {
            [STATES.COMPLETED]: "coding:agent:complete",
            [STATES.FAILED]: "coding:agent:error",
            [STATES.CANCELLED]: "coding:agent:cancelled",
            [STATES.LIMIT_REACHED]: "coding:agent:complete"
        }[state] || "coding:agent:complete";
        this._emit(session, eventName, { state, message: session.message });
        // Best-effort, fire-and-forget - the caller gets its result
        // immediately rather than waiting on a persistence write.
        this._persist(session).catch(() => {});
        return this._snapshot(session);
    }

    _snapshot(session) {
        return {
            sessionId: session.sessionId,
            state: session.state,
            text: session.finalText,
            message: session.message,
            changedFiles: [...session.changedFiles],
            iterations: session.iterations,
            toolCalls: session.toolCalls,
            pendingApproval: session.pendingApproval
        };
    }

    _redactArgs(args = {}) {
        // file_write/file_create content can be large - keep activity
        // events compact; full content already lives in the actual file
        // and in coding:tool:result summaries, not duplicated here.
        const { content, ...rest } = args;
        return content !== undefined ? { ...rest, contentLength: content.length } : args;
    }

    _summarizeResult(toolName, result) {
        if (!result) return "no result";
        if (!result.success) return result.message || "failed";
        if (toolName === "file_read") return `${(result.content || "").length} chars`;
        if (toolName === "workspace_list") return `${(result.entries || []).length} entries`;
        if (toolName === "workspace_search") return `${(result.results || []).length} matches`;
        if (TERMINAL_TOOLS.has(toolName)) return `exit ${result.exitCode}`;
        return "ok";
    }
}

module.exports = { CodingAgentRuntime: new CodingAgentRuntime(), STATES };
