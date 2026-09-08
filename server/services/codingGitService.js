const { spawn } = require("child_process");

const { CodingWorkspaceService, WorkspaceAccessError } = require("./codingWorkspaceService");

/**
 * ==========================================
 * CodingGitService
 * ------------------------------------------
 * A deliberately narrow git surface for the coding agent/UI:
 *   status, diff, log, stage, unstage, commit, currentBranch, listBranches
 *
 * On purpose, this service does NOT implement push, pull, reset --hard,
 * clean -f, or checkout -- . Those are exactly the operations the spec
 * calls out as things the AI must never run automatically. If a truly
 * destructive git command is ever needed it goes through
 * CodingTerminalService (which requires explicit confirmed:true for
 * `git reset --hard` / `git clean -f` / `git push --force`), never through
 * this "safe" surface.
 *
 * Every call resolves cwd through CodingWorkspaceService.resolveSafe, so
 * git can never be pointed outside the configured workspace. Arguments are
 * passed as argv arrays (spawn without shell:true) rather than building a
 * command string, so a commit message containing quotes/backticks can
 * never break out into shell interpretation.
 * ==========================================
 */

const GIT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 300 * 1024;

class GitCommandError extends Error {
    constructor(message, code, extra = {}) {
        super(message);
        this.name = "GitCommandError";
        this.code = code;
        Object.assign(this, extra);
    }
}

class CodingGitService {
    _run(userId, args, { cwd = "." } = {}) {
        const absCwd = CodingWorkspaceService.resolveSafe(userId, cwd);

        return new Promise((resolve, reject) => {
            const child = spawn("git", args, { cwd: absCwd, windowsHide: true });

            let stdout = "";
            let stderr = "";
            const timer = setTimeout(() => {
                try { child.kill("SIGKILL"); } catch { /* already exited */ }
            }, GIT_TIMEOUT_MS);

            child.stdout.on("data", (c) => { if (stdout.length < MAX_OUTPUT_BYTES) stdout += c.toString("utf8"); });
            child.stderr.on("data", (c) => { if (stderr.length < MAX_OUTPUT_BYTES) stderr += c.toString("utf8"); });

            child.on("close", (exitCode) => {
                clearTimeout(timer);
                if (exitCode !== 0) {
                    reject(new GitCommandError(`git ${args.join(" ")} failed: ${stderr.trim() || stdout.trim()}`, "GIT_COMMAND_FAILED", { exitCode, stdout, stderr }));
                    return;
                }
                resolve({ stdout, stderr, exitCode });
            });

            child.on("error", (err) => {
                clearTimeout(timer);
                reject(new GitCommandError(`Failed to run git: ${err.message}`, "GIT_SPAWN_FAILED"));
            });
        });
    }

    async _assertIsRepo(userId, cwd) {
        try {
            await this._run(userId, ["rev-parse", "--is-inside-work-tree"], { cwd });
        } catch {
            throw new GitCommandError("This workspace is not a git repository.", "NOT_A_REPO");
        }
    }

    async status(userId, { cwd = "." } = {}) {
        await this._assertIsRepo(userId, cwd);
        const { stdout } = await this._run(userId, ["status", "--porcelain=v1", "-b"], { cwd });
        const lines = stdout.split("\n").filter(Boolean);
        const branchLine = lines.find((l) => l.startsWith("##"));
        const files = lines
            .filter((l) => !l.startsWith("##"))
            .map((line) => ({
                status: line.slice(0, 2).trim(),
                path: line.slice(3)
            }));
        return {
            branch: branchLine ? branchLine.replace("## ", "").split("...")[0] : null,
            files
        };
    }

    async diff(userId, { file, staged = false, cwd = "." } = {}) {
        await this._assertIsRepo(userId, cwd);
        const args = ["diff"];
        if (staged) args.push("--staged");
        if (file) args.push("--", file);
        const { stdout } = await this._run(userId, args, { cwd });
        return { diff: stdout };
    }

    async log(userId, { limit = 20, cwd = "." } = {}) {
        await this._assertIsRepo(userId, cwd);
        const boundedLimit = Math.min(Math.max(1, Number(limit) || 20), 200);
        const { stdout } = await this._run(
            userId,
            ["log", `-n${boundedLimit}`, "--pretty=format:%H%x1f%an%x1f%ad%x1f%s%x1e", "--date=iso-strict"],
            { cwd }
        );
        const commits = stdout.split("\x1e").filter(Boolean).map((entry) => {
            const [hash, author, date, subject] = entry.replace(/^\n/, "").split("\x1f");
            return { hash, author, date, subject };
        });
        return { commits };
    }

    async stage(userId, files, { cwd = "." } = {}) {
        await this._assertIsRepo(userId, cwd);
        if (!Array.isArray(files) || files.length === 0) {
            throw new GitCommandError("At least one file path is required to stage.", "INVALID_ARGS");
        }
        await this._run(userId, ["add", "--", ...files], { cwd });
        return this.status(userId, { cwd });
    }

    async unstage(userId, files, { cwd = "." } = {}) {
        await this._assertIsRepo(userId, cwd);
        if (!Array.isArray(files) || files.length === 0) {
            throw new GitCommandError("At least one file path is required to unstage.", "INVALID_ARGS");
        }
        await this._run(userId, ["restore", "--staged", "--", ...files], { cwd });
        return this.status(userId, { cwd });
    }

    /**
     * Commits currently staged changes. This is the one write-ish git
     * operation this service performs - and even then only a local
     * commit, never a push. Callers (UI or agent) are expected to have
     * shown the user the message and staged file list before calling
     * this; there is no separate server-side "are you sure" gate here
     * because the actual user-facing confirmation step belongs in the UI,
     * not duplicated in three services.
     */
    async commit(userId, message, { cwd = "." } = {}) {
        await this._assertIsRepo(userId, cwd);
        if (!message || !message.trim()) {
            throw new GitCommandError("A commit message is required.", "INVALID_ARGS");
        }
        const { files } = await this.status(userId, { cwd });
        const hasStaged = files.some((f) => f.status[0] && f.status[0] !== " " && f.status[0] !== "?");
        if (!hasStaged) {
            throw new GitCommandError("Nothing is staged to commit.", "NOTHING_STAGED");
        }
        const { stdout } = await this._run(userId, ["commit", "-m", message], { cwd });
        return { output: stdout };
    }

    async currentBranch(userId, { cwd = "." } = {}) {
        await this._assertIsRepo(userId, cwd);
        const { stdout } = await this._run(userId, ["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
        return stdout.trim();
    }

    async listBranches(userId, { cwd = "." } = {}) {
        await this._assertIsRepo(userId, cwd);
        const { stdout } = await this._run(userId, ["branch", "--list"], { cwd });
        return stdout.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => ({
            name: l.replace(/^\*\s*/, ""),
            current: l.startsWith("*")
        }));
    }
}

module.exports = {
    CodingGitService: new CodingGitService(),
    GitCommandError
};
