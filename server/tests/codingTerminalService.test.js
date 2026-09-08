const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { CodingWorkspaceService } = require("../services/codingWorkspaceService");
const { CodingTerminalService, TerminalCommandError } = require("../services/codingTerminalService");

function makeWorkspace(userId = "termuser") {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-term-"));
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

test("CodingTerminalService: runs a real command and captures real stdout", async () => {
    makeWorkspace();
    const result = await CodingTerminalService.run("termuser", `node -e "console.log('hello-from-real-process')"`);
    assert.equal(result.success, true);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /hello-from-real-process/);
});

test("CodingTerminalService: reports non-zero exit codes as a failed but valid result, not a throw", async () => {
    makeWorkspace();
    const result = await CodingTerminalService.run("termuser", `node -e "process.exit(3)"`);
    assert.equal(result.success, false);
    assert.equal(result.exitCode, 3);
});

test("CodingTerminalService: runs inside the resolved workspace cwd", async () => {
    const root = makeWorkspace();
    fs.writeFileSync(path.join(root, "marker.txt"), "present");
    const result = await CodingTerminalService.run(
        "termuser",
        process.platform === "win32" ? "dir" : "ls"
    );
    assert.match(result.stdout, /marker\.txt/);
});

test("CodingTerminalService: hard-blocks a fork bomb / disk-format style command before spawning", async () => {
    makeWorkspace();
    assert.throws(
        () => CodingTerminalService.run("termuser", "mkfs.ext4 /dev/sda1"),
        (err) => err instanceof TerminalCommandError && err.code === "COMMAND_BLOCKED"
    );
});

test("CodingTerminalService: requires explicit confirmation for rm -rf", async () => {
    makeWorkspace();
    assert.throws(
        () => CodingTerminalService.run("termuser", "rm -rf build"),
        (err) => err instanceof TerminalCommandError && err.code === "CONFIRMATION_REQUIRED"
    );
});

test("CodingTerminalService: rm -rf proceeds once confirmed:true is passed", async () => {
    const root = makeWorkspace();
    fs.mkdirSync(path.join(root, "build"));
    fs.writeFileSync(path.join(root, "build", "x.txt"), "x");
    if (process.platform === "win32") return; // rm not native on win32 shell without WSL
    const result = await CodingTerminalService.run("termuser", "rm -rf build", { confirmed: true });
    assert.equal(result.success, true);
    assert.equal(fs.existsSync(path.join(root, "build")), false);
});

test("CodingTerminalService: kills a command that exceeds its timeout", async () => {
    makeWorkspace();
    const start = Date.now();
    const result = await CodingTerminalService.run(
        "termuser",
        `node -e "setTimeout(() => {}, 30000)"`,
        { timeoutMs: 300 }
    );
    const elapsed = Date.now() - start;
    assert.equal(result.timedOut, true);
    assert.equal(result.success, false);
    assert.ok(elapsed < 5000, `expected the process to be killed quickly, took ${elapsed}ms`);
});

test("CodingTerminalService: cancel() actually terminates a running process early", async () => {
    makeWorkspace();
    const runPromise = CodingTerminalService.run(
        "termuser",
        `node -e "setTimeout(() => {}, 30000)"`,
        { timeoutMs: 30000 }
    );

    // Give the child a moment to actually spawn, then cancel it.
    await new Promise((r) => setTimeout(r, 200));
    // We don't have the runId until the promise resolves in this simple
    // API, so exercise cancel() via the internal map directly for this
    // test - real callers get runId from an in-flight event, not the
    // final resolved result (see CodingWorkspaceCapability for that flow).
    const [runId] = CodingTerminalService._running.keys();
    assert.ok(runId, "expected a running process to be tracked");
    const cancelled = CodingTerminalService.cancel(runId);
    assert.equal(cancelled, true);

    const result = await runPromise;
    assert.equal(result.cancelled, true);
});

test("CodingTerminalService: rejects a cwd that escapes the workspace", async () => {
    makeWorkspace();
    assert.throws(() => CodingTerminalService.run("termuser", "ls", { cwd: "../../" }));
});
