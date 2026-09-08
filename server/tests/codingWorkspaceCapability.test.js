const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { CodingWorkspaceService } = require("../services/codingWorkspaceService");
const capability = require("../capabilities/CodingWorkspaceCapability");

function makeWorkspace(userId = "capuser") {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-cap-"));
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

test("CodingWorkspaceCapability: rejects any action without __ownerId", async () => {
    const result = await capability.execute({ action: "workspace.list", params: {} });
    assert.equal(result.success, false);
    assert.match(result.message, /authenticated owner/i);
});

test("CodingWorkspaceCapability: file.write then file.read round-trip through the capability dispatch layer", async () => {
    makeWorkspace();
    const write = await capability.execute({
        action: "file.write",
        params: { path: "src/index.js", content: "console.log('hi');\n" },
        __ownerId: "capuser"
    });
    assert.equal(write.success, true);

    const read = await capability.execute({
        action: "file.read",
        params: { path: "src/index.js" },
        __ownerId: "capuser"
    });
    assert.equal(read.success, true);
    assert.equal(read.content, "console.log('hi');\n");
});

test("CodingWorkspaceCapability: file.delete refuses without confirmed:true, then succeeds with it", async () => {
    makeWorkspace();
    await capability.execute({ action: "file.write", params: { path: "temp.txt", content: "x" }, __ownerId: "capuser" });

    const denied = await capability.execute({ action: "file.delete", params: { path: "temp.txt" }, __ownerId: "capuser" });
    assert.equal(denied.success, false);
    assert.equal(denied.code, "CONFIRMATION_REQUIRED");

    const allowed = await capability.execute({ action: "file.delete", params: { path: "temp.txt", confirmed: true }, __ownerId: "capuser" });
    assert.equal(allowed.success, true);
});

test("CodingWorkspaceCapability: a malicious plan cannot smuggle a different owner via params.__ownerId - only the injected top-level __ownerId is honored", async () => {
    const rootA = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-cap-"));
    const rootB = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-cap-"));
    const settings = { capuser: { codingWorkspace: rootA }, otheruser: { codingWorkspace: rootB } };
    Object.defineProperty(CodingWorkspaceService, "settingsService", {
        get() { return { getSettings: (id) => settings[id] || {} }; },
        configurable: true
    });

    const result = await capability.execute({
        action: "file.write",
        params: { path: "x.txt", content: "mine", __ownerId: "otheruser" },
        __ownerId: "capuser"
    });
    assert.equal(result.success, true);
    // Confirm it landed in capuser's workspace, not otheruser's - the
    // capability signature only ever destructures the top-level __ownerId.
    const read = await capability.execute({ action: "file.read", params: { path: "x.txt" }, __ownerId: "capuser" });
    assert.equal(read.content, "mine");
    assert.equal(fs.existsSync(path.join(rootA, "x.txt")), true);
    assert.equal(fs.existsSync(path.join(rootB, "x.txt")), false);
});

test("CodingWorkspaceCapability: terminal.run executes a real command through the capability", async () => {
    makeWorkspace();
    const result = await capability.execute({
        action: "terminal.run",
        params: { command: `node -e "console.log('via-capability')"` },
        __ownerId: "capuser"
    });
    assert.equal(result.success, true);
    assert.match(result.stdout, /via-capability/);
});

test("CodingWorkspaceCapability: git.status on a non-repo workspace returns a clean failure, not a throw", async () => {
    makeWorkspace();
    const result = await capability.execute({ action: "git.status", params: {}, __ownerId: "capuser" });
    assert.equal(result.success, false);
    assert.equal(result.code, "NOT_A_REPO");
});

test("CodingWorkspaceCapability: unknown action returns a clean failure", async () => {
    makeWorkspace();
    const result = await capability.execute({ action: "file.teleport", params: {}, __ownerId: "capuser" });
    assert.equal(result.success, false);
    assert.match(result.message, /Unknown coding workspace action/);
});
