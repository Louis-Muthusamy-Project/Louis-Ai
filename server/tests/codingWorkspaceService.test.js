const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { CodingWorkspaceService, WorkspaceAccessError } = require("../services/codingWorkspaceService");

/**
 * Builds an isolated temp workspace directory and a fake settingsService so
 * these tests never touch real user settings files or a real repository.
 */
function makeWorkspace(userId = "user1") {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-ws-"));
    const fakeSettings = { [userId]: { codingWorkspace: root } };

    CodingWorkspaceService.settingsServiceOverride = {
        getSettings: (id) => fakeSettings[id] || {},
        updateSettings: (id, values) => {
            fakeSettings[id] = { ...(fakeSettings[id] || {}), ...values };
            return fakeSettings[id];
        }
    };
    // Patch the getter for the duration of the test file - see teardown below.
    Object.defineProperty(CodingWorkspaceService, "settingsService", {
        get() { return CodingWorkspaceService.settingsServiceOverride; },
        configurable: true
    });

    return root;
}

test("CodingWorkspaceService: resolveSafe allows a plain relative path inside the workspace", () => {
    const root = makeWorkspace();
    const abs = CodingWorkspaceService.resolveSafe("user1", "src/index.js");
    assert.equal(abs, path.join(root, "src", "index.js"));
});

test("CodingWorkspaceService: resolveSafe blocks ../ traversal outside the workspace", () => {
    makeWorkspace();
    assert.throws(
        () => CodingWorkspaceService.resolveSafe("user1", "../../etc/passwd"),
        WorkspaceAccessError
    );
});

test("CodingWorkspaceService: resolveSafe rejects absolute paths outright", () => {
    makeWorkspace();
    assert.throws(
        () => CodingWorkspaceService.resolveSafe("user1", "/etc/passwd"),
        WorkspaceAccessError
    );
});

test("CodingWorkspaceService: throws NO_WORKSPACE when nothing is configured", () => {
    Object.defineProperty(CodingWorkspaceService, "settingsService", {
        get() { return { getSettings: () => ({}) }; },
        configurable: true
    });
    assert.throws(
        () => CodingWorkspaceService.resolveSafe("user-with-no-workspace", "foo.js"),
        (err) => err instanceof WorkspaceAccessError && err.code === "NO_WORKSPACE"
    );
});

test("CodingWorkspaceService: write then read round-trips file content", () => {
    makeWorkspace();
    CodingWorkspaceService.writeFile("user1", "src/App.jsx", "export default function App() {}\n");
    const { content } = CodingWorkspaceService.readFile("user1", "src/App.jsx");
    assert.equal(content, "export default function App() {}\n");
});

test("CodingWorkspaceService: readFile refuses secret files without acknowledgeSecret", () => {
    const root = makeWorkspace();
    fs.writeFileSync(path.join(root, ".env"), "API_KEY=abc123\n");
    assert.throws(
        () => CodingWorkspaceService.readFile("user1", ".env"),
        (err) => err instanceof WorkspaceAccessError && err.code === "SECRET_FILE_BLOCKED"
    );
});

test("CodingWorkspaceService: readFile allows secret files WITH explicit acknowledgeSecret", () => {
    const root = makeWorkspace();
    fs.writeFileSync(path.join(root, ".env"), "API_KEY=abc123\n");
    const { content } = CodingWorkspaceService.readFile("user1", ".env", { acknowledgeSecret: true });
    assert.equal(content, "API_KEY=abc123\n");
});

test("CodingWorkspaceService: list() excludes node_modules and marks secret files", () => {
    const root = makeWorkspace();
    fs.mkdirSync(path.join(root, "node_modules"));
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    fs.writeFileSync(path.join(root, ".env"), "SECRET=1");

    const entries = CodingWorkspaceService.list("user1", ".");
    const names = entries.map((e) => e.name);
    assert.ok(!names.includes("node_modules"));
    assert.ok(names.includes("package.json"));
    const envEntry = entries.find((e) => e.name === ".env");
    assert.equal(envEntry.secret, true);
});

test("CodingWorkspaceService: deleteFile removes a file inside the workspace", () => {
    makeWorkspace();
    CodingWorkspaceService.writeFile("user1", "temp.txt", "bye");
    const result = CodingWorkspaceService.deleteFile("user1", "temp.txt");
    assert.equal(result.deleted, true);
    assert.throws(() => CodingWorkspaceService.readFile("user1", "temp.txt"));
});

test("CodingWorkspaceService: search finds a filename match and a content match", () => {
    makeWorkspace();
    CodingWorkspaceService.writeFile("user1", "src/Login.jsx", "export function Login() { return null; }");
    CodingWorkspaceService.writeFile("user1", "src/Other.jsx", "// nothing relevant here");

    const byName = CodingWorkspaceService.search("user1", "login");
    assert.ok(byName.some((r) => r.path === "src/Login.jsx" && r.matchType === "filename"));

    const byContent = CodingWorkspaceService.search("user1", "nothing relevant");
    assert.ok(byContent.some((r) => r.path === "src/Other.jsx" && r.matchType === "content"));
});

test("CodingWorkspaceService: search never returns secret files even as content matches", () => {
    const root = makeWorkspace();
    fs.writeFileSync(path.join(root, ".env"), "SUPER_SECRET_TOKEN=xyz");
    const results = CodingWorkspaceService.search("user1", "SUPER_SECRET_TOKEN");
    assert.equal(results.length, 0);
});

test("CodingWorkspaceService: renameFile moves a file within the workspace", () => {
    makeWorkspace();
    CodingWorkspaceService.writeFile("user1", "old.js", "1");
    CodingWorkspaceService.renameFile("user1", "old.js", "nested/new.js");
    assert.equal(CodingWorkspaceService.readFile("user1", "nested/new.js").content, "1");
    assert.throws(() => CodingWorkspaceService.readFile("user1", "old.js"));
});

test("CodingWorkspaceService: readFile returns a content hash usable for conflict detection", () => {
    makeWorkspace();
    CodingWorkspaceService.writeFile("user1", "a.txt", "version1");
    const { hash } = CodingWorkspaceService.readFile("user1", "a.txt");
    assert.equal(typeof hash, "string");
    assert.ok(hash.length > 0);
});

test("CodingWorkspaceService: writeFile with a stale expectedHash is rejected as a CONFLICT - real external-change detection", () => {
    makeWorkspace();
    CodingWorkspaceService.writeFile("user1", "a.txt", "version1");
    const { hash: originalHash } = CodingWorkspaceService.readFile("user1", "a.txt");

    // Someone/something else changes the file after that read.
    CodingWorkspaceService.writeFile("user1", "a.txt", "version2 - changed externally");

    assert.throws(
        () => CodingWorkspaceService.writeFile("user1", "a.txt", "my edit based on the stale version", { expectedHash: originalHash }),
        (err) => err instanceof WorkspaceAccessError && err.code === "CONFLICT"
    );
    // The external change must survive - the conflicting write never happened.
    assert.equal(CodingWorkspaceService.readFile("user1", "a.txt").content, "version2 - changed externally");
});

test("CodingWorkspaceService: writeFile with a matching expectedHash succeeds normally", () => {
    makeWorkspace();
    CodingWorkspaceService.writeFile("user1", "a.txt", "version1");
    const { hash } = CodingWorkspaceService.readFile("user1", "a.txt");
    CodingWorkspaceService.writeFile("user1", "a.txt", "version2 - my edit", { expectedHash: hash });
    assert.equal(CodingWorkspaceService.readFile("user1", "a.txt").content, "version2 - my edit");
});

test("CodingWorkspaceService: setWorkspaceRoot rejects a non-existent path", () => {
    makeWorkspace();
    assert.throws(() => CodingWorkspaceService.setWorkspaceRoot("user1", "/definitely/not/a/real/path/xyz"));
});
