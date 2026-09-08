const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const EventEmitter = require("events");

const { CodingWorkspaceService } = require("../services/codingWorkspaceService");
const { CodingAgentRuntime, STATES } = require("../services/coding/CodingAgentRuntime");
const CodingModelProvider = require("../services/coding/CodingModelProvider");

function makeWorkspace(userId = "agentuser") {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-agent-"));
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

/**
 * A scripted stand-in for a live model. Each entry in `script` is either:
 *   { calls: [{name, args}], text? }   -> this turn requests these tool calls
 *   { text: "..." }                    -> this turn is a final answer, no calls
 * History here is just an array we push turn markers onto - the runtime
 * never inspects its shape, exactly as the interface promises.
 */
class FakeCodingModelProvider extends CodingModelProvider {
    constructor(script, { configured = true } = {}) {
        super();
        this.script = script;
        this.turnIndex = 0;
        this.configured = configured;
        this.sentHistories = [];
        this.resultBatches = [];
    }
    getName() { return "fake"; }
    isConfigured() { return this.configured; }
    buildInitialHistory(taskText) { return [{ turn: "initial", taskText }]; }
    async sendTurn(history) {
        this.sentHistories.push(history);
        const step = this.script[this.turnIndex] || { text: "done (script exhausted)" };
        this.turnIndex += 1;
        const functionCalls = (step.calls || []).map((c, i) => ({ id: `f${this.turnIndex}_${i}`, name: c.name, args: c.args }));
        this._lastText = step.text || "";
        return { functionCalls, text: this._lastText };
    }
    appendModelTurn(history) {
        return [...history, { turn: "model", text: this._lastText }];
    }
    appendFunctionResultsTurn(history, callsWithResults) {
        this.resultBatches.push(callsWithResults);
        return [...history, { turn: "function_results", count: callsWithResults.length }];
    }
}

test("CodingAgentRuntime: full loop actually writes a file, actually runs a real command, and completes", async () => {
    const root = makeWorkspace();
    const script = [
        { calls: [{ name: "file_create", args: { path: "coding-agent-test.txt", content: "Yuna Coding Agent Works" } }] },
        { calls: [{ name: "file_read", args: { path: "coding-agent-test.txt" } }] },
        { calls: [{ name: "terminal_run", args: { command: `node -e "console.log('ran-for-real')"` } }] },
        { text: "Created the file and verified the command ran successfully." }
    ];
    const provider = new FakeCodingModelProvider(script);

    const events = [];
    const bus = new EventEmitter();
    bus.on("coding:tool:result", (e) => events.push(e));
    CodingAgentRuntime.initialize(bus);

    const result = await CodingAgentRuntime.run("agentuser", "Create a test file and verify a command runs.", provider);

    assert.equal(result.state, STATES.COMPLETED);
    assert.equal(result.text, "Created the file and verified the command ran successfully.");
    assert.ok(result.changedFiles.includes("coding-agent-test.txt"));

    // The critical assertion: the file is REALLY on disk with REAL content -
    // not just claimed in the model's final text.
    const onDisk = fs.readFileSync(path.join(root, "coding-agent-test.txt"), "utf8");
    assert.equal(onDisk, "Yuna Coding Agent Works");

    // And the terminal command REALLY ran (its real stdout was captured).
    const terminalEvent = events.find((e) => e.tool === "terminal_run");
    assert.equal(terminalEvent.success, true);

    // Gemini-style batching: each turn's function results went back as ONE batch.
    assert.equal(provider.resultBatches.length, 3);
    assert.equal(provider.resultBatches[0].length, 1);
});

test("CodingAgentRuntime: iterative fix-the-failing-test behavior - edit, test, fail, investigate, edit, test, pass", async () => {
    const root = makeWorkspace();
    fs.writeFileSync(path.join(root, "add.js"), "function add(a, b) { return a - b; } // bug\nmodule.exports = add;\n");
    fs.writeFileSync(
        path.join(root, "add.test.js"),
        "const add = require('./add');\nif (add(2, 3) !== 5) { console.error('FAIL: expected 5'); process.exit(1); }\nconsole.log('PASS');\n"
    );

    const script = [
        { calls: [{ name: "file_read", args: { path: "add.js" } }] },
        { calls: [{ name: "terminal_run", args: { command: "node add.test.js" } }] }, // fails first
        { calls: [{ name: "file_write", args: { path: "add.js", content: "function add(a, b) { return a + b; }\nmodule.exports = add;\n" } }] },
        { calls: [{ name: "terminal_run", args: { command: "node add.test.js" } }] }, // passes now
        { text: "Fixed the bug in add.js (was subtracting instead of adding) and confirmed the test passes." }
    ];
    const provider = new FakeCodingModelProvider(script);
    CodingAgentRuntime.initialize(new EventEmitter());

    const result = await CodingAgentRuntime.run("agentuser", "Find and fix the failing test.", provider);

    assert.equal(result.state, STATES.COMPLETED);
    assert.match(fs.readFileSync(path.join(root, "add.js"), "utf8"), /a \+ b/);

    // Re-run the real test file ourselves to independently confirm it now passes.
    const { execSync } = require("child_process");
    const out = execSync("node add.test.js", { cwd: root }).toString();
    assert.match(out, /PASS/);
});

test("CodingAgentRuntime: stops safely at maxIterations without crashing, preserving prior changes", async () => {
    makeWorkspace();
    // A provider that requests a harmless tool call forever - simulates a
    // model that never converges.
    const infiniteScript = Array.from({ length: 50 }, (_, i) => ({
        calls: [{ name: "file_write", args: { path: "loop.txt", content: `iteration ${i}` } }]
    }));
    const provider = new FakeCodingModelProvider(infiniteScript);
    CodingAgentRuntime.initialize(new EventEmitter());

    const result = await CodingAgentRuntime.run("agentuser", "loop forever", provider, { maxIterations: 5 });

    assert.equal(result.state, STATES.LIMIT_REACHED);
    assert.equal(result.iterations, 5);
    assert.match(result.message, /maximum iteration limit/);
    // The file from the last successful iteration is still there - not rolled back.
    assert.ok(fs.existsSync(path.join(CodingWorkspaceService.getWorkspaceRoot("agentuser"), "loop.txt")));
});

test("CodingAgentRuntime: stops safely at maxToolCalls even within a single turn", async () => {
    makeWorkspace();
    const manyCallsInOneTurn = {
        calls: Array.from({ length: 20 }, (_, i) => ({ name: "file_write", args: { path: `f${i}.txt`, content: "x" } }))
    };
    const provider = new FakeCodingModelProvider([manyCallsInOneTurn, { text: "done" }]);
    CodingAgentRuntime.initialize(new EventEmitter());

    const result = await CodingAgentRuntime.run("agentuser", "write many files", provider, { maxToolCalls: 3 });

    assert.equal(result.state, STATES.LIMIT_REACHED);
    assert.equal(result.toolCalls, 3);
});

test("CodingAgentRuntime: cancel() actually stops the loop and kills a real running terminal process", async () => {
    makeWorkspace();
    const script = [
        { calls: [{ name: "terminal_run", args: { command: `node -e "setTimeout(() => {}, 30000)"` } }] },
        { text: "should never get here" }
    ];
    const provider = new FakeCodingModelProvider(script);
    const bus = new EventEmitter();
    let capturedSessionId = null;
    bus.on("coding:session:start", (e) => { capturedSessionId = e.sessionId; });
    CodingAgentRuntime.initialize(bus);

    const runPromise = CodingAgentRuntime.run("agentuser", "run something long", provider);

    // Give the terminal command a moment to actually spawn, then cancel.
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(capturedSessionId, "expected to capture a session id from coding:session:start");
    const cancelled = CodingAgentRuntime.cancel(capturedSessionId);
    assert.equal(cancelled, true);

    const result = await runPromise;
    assert.equal(result.state, STATES.CANCELLED);
    // Only got through the first scripted turn - never reached the second.
    assert.equal(provider.turnIndex, 1);
});

test("CodingAgentRuntime: a destructive action requiring confirmation pauses the run instead of executing or auto-approving", async () => {
    const root = makeWorkspace();
    fs.writeFileSync(path.join(root, "important.txt"), "keep me");
    const script = [
        { calls: [{ name: "file_delete", args: { path: "important.txt", confirmed: false } }] }
    ];
    const provider = new FakeCodingModelProvider(script);
    const events = [];
    const bus = new EventEmitter();
    bus.on("coding:approval:required", (e) => events.push(e));
    CodingAgentRuntime.initialize(bus);

    const result = await CodingAgentRuntime.run("agentuser", "delete the important file", provider);

    assert.equal(result.state, STATES.WAITING_FOR_APPROVAL);
    assert.equal(result.pendingApproval.reason, "CONFIRMATION_REQUIRED");
    assert.equal(events.length, 1);
    // The file must still exist - nothing was auto-approved.
    assert.ok(fs.existsSync(path.join(root, "important.txt")));
});

test("CodingAgentRuntime: refuses to run with an unconfigured provider", async () => {
    makeWorkspace();
    const provider = new FakeCodingModelProvider([{ text: "n/a" }], { configured: false });
    await assert.rejects(
        () => CodingAgentRuntime.run("agentuser", "anything", provider),
        /not configured/
    );
});
