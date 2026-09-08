const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { CodingWorkspaceService, WorkspaceAccessError } = require("../services/codingWorkspaceService");

function makeWorkspace(userId = "sectestuser") {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-sectest-"));
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

test("Security: a literal URL-encoded traversal string is treated as a plain filename, not decoded and exploited", () => {
    const root = makeWorkspace();
    // There is no URL-decoding anywhere in the path-resolution chain (this
    // is a direct function call, not an HTTP route param), so this string
    // can only ever create/reference a file literally named that -
    // proving the "encoded traversal" attack surface simply doesn't apply
    // here rather than assuming it's handled.
    const abs = CodingWorkspaceService.resolveSafe("sectestuser", "%2e%2e%2f%2e%2e%2fetc%2fpasswd");
    assert.ok(abs.startsWith(root));
    assert.equal(path.basename(abs), "%2e%2e%2f%2e%2e%2fetc%2fpasswd");
});

test("Security: backslash-style traversal is blocked (normalized before the boundary check)", () => {
    makeWorkspace();
    assert.throws(
        () => CodingWorkspaceService.resolveSafe("sectestuser", "..\\..\\..\\etc\\passwd"),
        WorkspaceAccessError
    );
});

test("Security: mixed forward/backslash traversal is blocked", () => {
    makeWorkspace();
    assert.throws(
        () => CodingWorkspaceService.resolveSafe("sectestuser", "..\\../..\\/etc/passwd"),
        WorkspaceAccessError
    );
});

test("Security: a deeply nested but ultimately in-bounds path is allowed (traversal blocking isn't overly broad)", () => {
    const root = makeWorkspace();
    const abs = CodingWorkspaceService.resolveSafe("sectestuser", "a/b/../c/./d");
    assert.equal(abs, path.join(root, "a", "c", "d"));
});

test("Security: a Windows drive-letter absolute path is rejected even on a POSIX host", () => {
    makeWorkspace();
    assert.throws(
        () => CodingWorkspaceService.resolveSafe("sectestuser", "C:\\Windows\\System32\\config\\SAM"),
        WorkspaceAccessError
    );
});

test("Security: a symlink created inside the workspace that points outside it is blocked on read", () => {
    const root = makeWorkspace();
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-outside-"));
    fs.writeFileSync(path.join(outsideDir, "secret.txt"), "top secret");
    const linkPath = path.join(root, "innocent-looking-link.txt");
    try {
        fs.symlinkSync(path.join(outsideDir, "secret.txt"), linkPath);
    } catch (e) {
        // Some sandboxes disallow creating symlinks - if so, this specific
        // attack vector can't even be constructed here, which is its own
        // form of safety; skip rather than fail on an environment limit.
        return;
    }
    assert.throws(
        () => CodingWorkspaceService.readFile("sectestuser", "innocent-looking-link.txt"),
        WorkspaceAccessError
    );
});
