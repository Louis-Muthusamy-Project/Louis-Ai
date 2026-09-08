const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const { CodingWorkspaceService } = require("../services/codingWorkspaceService");
const { CodingGitService, GitCommandError } = require("../services/codingGitService");

function makeGitWorkspace(userId = "gituser") {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-git-"));
    execSync("git init -q", { cwd: root });
    execSync('git config user.email "test@yuna.local"', { cwd: root });
    execSync('git config user.name "Yuna Test"', { cwd: root });
    fs.writeFileSync(path.join(root, "README.md"), "# hello\n");
    execSync("git add . && git commit -q -m initial", { cwd: root });

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

test("CodingGitService: status reports a clean repo with no changes", async () => {
    makeGitWorkspace();
    const status = await CodingGitService.status("gituser");
    assert.equal(status.files.length, 0);
});

test("CodingGitService: status reports a real untracked/modified file", async () => {
    const root = makeGitWorkspace();
    fs.writeFileSync(path.join(root, "new.js"), "console.log(1);\n");
    const status = await CodingGitService.status("gituser");
    assert.ok(status.files.some((f) => f.path === "new.js" && f.status === "??"));
});

test("CodingGitService: stage then commit actually creates a real commit", async () => {
    const root = makeGitWorkspace();
    fs.writeFileSync(path.join(root, "feature.js"), "export const x = 1;\n");
    await CodingGitService.stage("gituser", ["feature.js"]);

    const statusAfterStage = await CodingGitService.status("gituser");
    assert.ok(statusAfterStage.files.some((f) => f.path === "feature.js" && f.status === "A"));

    await CodingGitService.commit("gituser", "Add feature.js");

    const log = await CodingGitService.log("gituser", { limit: 5 });
    assert.equal(log.commits[0].subject, "Add feature.js");

    const statusAfterCommit = await CodingGitService.status("gituser");
    assert.equal(statusAfterCommit.files.length, 0);
});

test("CodingGitService: commit rejects with nothing staged", async () => {
    makeGitWorkspace();
    await assert.rejects(
        () => CodingGitService.commit("gituser", "empty commit attempt"),
        (err) => err instanceof GitCommandError && err.code === "NOTHING_STAGED"
    );
});

test("CodingGitService: diff shows real added lines for a staged change", async () => {
    const root = makeGitWorkspace();
    fs.writeFileSync(path.join(root, "README.md"), "# hello\nnew line\n");
    const { diff } = await CodingGitService.diff("gituser");
    assert.match(diff, /\+new line/);
});

test("CodingGitService: currentBranch and listBranches reflect the real repo", async () => {
    makeGitWorkspace();
    const branch = await CodingGitService.currentBranch("gituser");
    const branches = await CodingGitService.listBranches("gituser");
    assert.ok(branches.some((b) => b.name === branch && b.current));
});

test("CodingGitService: status on a non-repo workspace throws NOT_A_REPO", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-not-git-"));
    const settings = { plainuser: { codingWorkspace: root } };
    Object.defineProperty(CodingWorkspaceService, "settingsService", {
        get() { return { getSettings: (id) => settings[id] || {} }; },
        configurable: true
    });
    await assert.rejects(
        () => CodingGitService.status("plainuser"),
        (err) => err instanceof GitCommandError && err.code === "NOT_A_REPO"
    );
});

test("CodingGitService: exposes no push/pull/reset method at all (destructive ops are simply not on this surface)", () => {
    assert.equal(typeof CodingGitService.push, "undefined");
    assert.equal(typeof CodingGitService.pull, "undefined");
    assert.equal(typeof CodingGitService.reset, "undefined");
    assert.equal(typeof CodingGitService.clean, "undefined");
});
