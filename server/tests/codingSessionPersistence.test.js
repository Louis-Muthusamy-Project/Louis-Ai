const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const EventEmitter = require("events");

const { CodingWorkspaceService } = require("../services/codingWorkspaceService");
const { CodingAgentRuntime, STATES } = require("../services/coding/CodingAgentRuntime");
const CodingModelProvider = require("../services/coding/CodingModelProvider");
const FileCodingSessionRepository = require("../infrastructure/FileCodingSessionRepository");
const CodingSessionService = require("../services/coding/CodingSessionService");

function makeWorkspace(userId) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-persist-"));
    const settings = { [userId]: { codingWorkspace: root } };
    Object.defineProperty(CodingWorkspaceService, "settingsService", {
        get() {
            return {
                getSettings: (id) => settings[id] || {},
                updateSettings: (id, v) => { settings[id] = { ...(settings[id] || {}), ...v }; }
            };
        },
        configurable: true
    });
    return root;
}

class FakeProvider extends CodingModelProvider {
    constructor(script, name = "fake") { super(); this.script = script; this.i = 0; this.name = name; }
    getName() { return this.name; }
    isConfigured() { return true; }
    buildInitialHistory(task) { return [{ turn: "initial", task }]; }
    async sendTurn(history) {
        const step = this.script[this.i] || { text: "done" };
        this.i += 1;
        return { functionCalls: (step.calls || []).map((c, idx) => ({ id: `c${this.i}_${idx}`, name: c.name, args: c.args })), text: step.text || "" };
    }
    appendModelTurn(history) { return [...history, { turn: "model" }]; }
    appendFunctionResultsTurn(history, callsWithResults) { return [...history, { turn: "results", count: callsWithResults.length }]; }
}

function makeRuntimeContext() {
    const repo = new FileCodingSessionRepository();
    const sessionService = new CodingSessionService(repo);
    return { sessionService };
}

test("CodingSessionService/FileCodingSessionRepository: save then getOwned round-trips a real file-backed record", async () => {
    const { sessionService } = makeRuntimeContext();
    const record = { sessionId: "s-abc", userId: "u1", providerName: "gemini", task: "do x", state: "COMPLETED", history: [{ a: 1 }], changedFiles: [], activity: [], updatedAt: Date.now() };
    await sessionService.save(record);

    const fetched = await sessionService.getOwned("u1", "s-abc");
    assert.ok(fetched);
    assert.equal(fetched.task, "do x");
    assert.deepEqual(fetched.history, [{ a: 1 }]);
});

test("CodingSessionService: getOwned returns null (not the record) when a different user asks for it", async () => {
    const { sessionService } = makeRuntimeContext();
    await sessionService.save({ sessionId: "s-owned", userId: "owner1", providerName: "gemini", task: "t", state: "COMPLETED", history: [], changedFiles: [], activity: [], updatedAt: Date.now() });

    const asOwner = await sessionService.getOwned("owner1", "s-owned");
    const asIntruder = await sessionService.getOwned("intruder1", "s-owned");
    assert.ok(asOwner);
    assert.equal(asIntruder, null);
});

test("CodingSessionService: listForUser only returns that user's own sessions", async () => {
    const { sessionService } = makeRuntimeContext();
    await sessionService.save({ sessionId: "sa1", userId: "userA", providerName: "gemini", task: "a", state: "COMPLETED", history: [], changedFiles: [], activity: [], updatedAt: 2 });
    await sessionService.save({ sessionId: "sa2", userId: "userA", providerName: "gemini", task: "a2", state: "COMPLETED", history: [], changedFiles: [], activity: [], updatedAt: 3 });
    await sessionService.save({ sessionId: "sb1", userId: "userB", providerName: "gemini", task: "b", state: "COMPLETED", history: [], changedFiles: [], activity: [], updatedAt: 1 });

    const listA = await sessionService.listForUser("userA");
    assert.equal(listA.length, 2);
    assert.ok(listA.every((r) => r.userId === "userA"));
    // most recent first
    assert.equal(listA[0].sessionId, "sa2");
});

test("CodingAgentRuntime + persistence: a full run persists a real record with state COMPLETED", async () => {
    makeWorkspace("persistuser1");
    const { sessionService } = makeRuntimeContext();
    CodingAgentRuntime.initialize(new EventEmitter(), { sessionService });

    const provider = new FakeProvider([{ text: "done, nothing to do" }]);
    const result = await CodingAgentRuntime.run("persistuser1", "just answer", provider);

    const persisted = await sessionService.getOwned("persistuser1", result.sessionId);
    assert.ok(persisted);
    assert.equal(persisted.state, "COMPLETED");
    assert.equal(persisted.task, "just answer");
});

test("CodingAgentRuntime.resume: approving a paused action actually executes it and continues the SAME conversation to completion", async () => {
    const root = makeWorkspace("persistuser2");
    fs.writeFileSync(path.join(root, "important.txt"), "keep me");
    const { sessionService } = makeRuntimeContext();
    CodingAgentRuntime.initialize(new EventEmitter(), { sessionService });

    const provider = new FakeProvider([
        { calls: [{ name: "file_delete", args: { path: "important.txt", confirmed: false } }] },
        { text: "deleted as requested" }
    ]);

    const paused = await CodingAgentRuntime.run("persistuser2", "delete the file", provider);
    assert.equal(paused.state, STATES.WAITING_FOR_APPROVAL);
    assert.ok(fs.existsSync(path.join(root, "important.txt")), "must not be deleted before approval");

    const resumed = await CodingAgentRuntime.resume("persistuser2", paused.sessionId, {
        approved: true,
        approvalId: paused.pendingApproval.approvalId
    });

    assert.equal(resumed.state, STATES.COMPLETED);
    assert.equal(resumed.text, "deleted as requested");
    assert.equal(fs.existsSync(path.join(root, "important.txt")), false, "the file must actually be deleted now that it was approved");
});

test("CodingAgentRuntime.resume: denying a paused action cancels the run and never executes it", async () => {
    const root = makeWorkspace("persistuser3");
    fs.writeFileSync(path.join(root, "important.txt"), "keep me");
    const { sessionService } = makeRuntimeContext();
    CodingAgentRuntime.initialize(new EventEmitter(), { sessionService });

    const provider = new FakeProvider([
        { calls: [{ name: "file_delete", args: { path: "important.txt", confirmed: false } }] }
    ]);
    const paused = await CodingAgentRuntime.run("persistuser3", "delete the file", provider);

    const denied = await CodingAgentRuntime.resume("persistuser3", paused.sessionId, {
        approved: false,
        approvalId: paused.pendingApproval.approvalId
    });

    assert.equal(denied.state, STATES.CANCELLED);
    assert.ok(fs.existsSync(path.join(root, "important.txt")), "denied action must never execute");
});

test("CodingAgentRuntime.resume: a stale/reused approvalId is rejected - replay protection", async () => {
    const root = makeWorkspace("persistuser4");
    fs.writeFileSync(path.join(root, "important.txt"), "keep me");
    const { sessionService } = makeRuntimeContext();
    CodingAgentRuntime.initialize(new EventEmitter(), { sessionService });

    const provider = new FakeProvider([
        { calls: [{ name: "file_delete", args: { path: "important.txt", confirmed: false } }] },
        { text: "done" }
    ]);
    const paused = await CodingAgentRuntime.run("persistuser4", "delete the file", provider);
    const realApprovalId = paused.pendingApproval.approvalId;

    await CodingAgentRuntime.resume("persistuser4", paused.sessionId, { approved: true, approvalId: realApprovalId });

    // Replaying the SAME approvalId again (e.g. a double-click, or a
    // replayed request) must be rejected - the session already moved on.
    await assert.rejects(
        () => CodingAgentRuntime.resume("persistuser4", paused.sessionId, { approved: true, approvalId: realApprovalId }),
        /not waiting for approval|Stale or invalid/
    );
});

test("CodingAgentRuntime.resume: a user cannot resume another user's paused session", async () => {
    makeWorkspace("victimuser");
    const { sessionService } = makeRuntimeContext();
    CodingAgentRuntime.initialize(new EventEmitter(), { sessionService });

    const provider = new FakeProvider([
        { calls: [{ name: "terminal_run", args: { command: "rm -rf build", confirmed: false } }] },
        { text: "done" }
    ]);
    const paused = await CodingAgentRuntime.run("victimuser", "clean build", provider);
    assert.equal(paused.state, STATES.WAITING_FOR_APPROVAL);

    await assert.rejects(
        () => CodingAgentRuntime.resume("attackeruser", paused.sessionId, { approved: true, approvalId: paused.pendingApproval.approvalId }),
        /No session found/
    );
});

test("CodingAgentRuntime.resume: genuinely resumes after the in-memory session is gone - reconstructed purely from the persisted record", async () => {
    const root = makeWorkspace("persistuser5");
    fs.writeFileSync(path.join(root, "important.txt"), "keep me");
    const { sessionService } = makeRuntimeContext();
    const providerRegistry = { getCodingProvider: () => new FakeProvider([{ text: "resumed after restart" }], "fake") };
    CodingAgentRuntime.initialize(new EventEmitter(), { sessionService, providerRegistry });

    const provider = new FakeProvider([
        { calls: [{ name: "file_delete", args: { path: "important.txt", confirmed: false } }] }
    ]);
    const paused = await CodingAgentRuntime.run("persistuser5", "delete the file", provider);

    // Simulate a server restart: this process's in-memory session map no
    // longer has it (as if a fresh CodingAgentRuntime instance had just
    // been created), but the persisted record is still on disk.
    CodingAgentRuntime._sessions.delete(paused.sessionId);

    const resumed = await CodingAgentRuntime.resume("persistuser5", paused.sessionId, {
        approved: true,
        approvalId: paused.pendingApproval.approvalId
    });

    assert.equal(resumed.state, STATES.COMPLETED);
    assert.equal(resumed.text, "resumed after restart");
    assert.equal(fs.existsSync(path.join(root, "important.txt")), false);
});
