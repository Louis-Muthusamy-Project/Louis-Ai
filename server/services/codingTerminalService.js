const { spawn } = require("child_process");
const crypto = require("crypto");

const { CodingWorkspaceService, WorkspaceAccessError } = require("./codingWorkspaceService");

/**
 * ==========================================
 * CodingTerminalService
 * ------------------------------------------
 * Runs a shell command scoped to a user's coding workspace directory. This
 * is intentionally NOT the same code path as the legacy
 * CodingCapability.runCommand() (server/capabilities/CodingCapability.js),
 * which:
 *   - defaults cwd to Yuna's OWN server repo root, not a user workspace
 *   - gates on PermissionService.check("execute_shell"), a scope that does
 *     not exist in PermissionService's scopes map, so that check always
 *     silently fails closed
 *   - uses a 4-string substring blocklist as its only safety net
 * That path is left in place (still referenced by the general
 * taskPlanner "coding" capability for ad-hoc one-off commands) but the
 * Coding panel's agent/terminal tools go through this service instead.
 *
 * Safety properties:
 *   - cwd is always resolved through CodingWorkspaceService.resolveSafe,
 *     so it can never leave the configured workspace root
 *   - a fixed set of command patterns are hard-BLOCKED outright (no
 *     legitimate coding-workspace use case: disk formatting, fork bombs,
 *     recursive delete of a filesystem root)
 *   - a second set requires an explicit confirmed:true from the caller
 *     (rm -rf, git reset --hard, git clean -f, git push --force, and
 *     similar - legitimate but destructive/irreversible)
 *   - every run is timeout-protected, output-capped, and cancellable by id
 * ==========================================
 */

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 5 * 60_000;
const MAX_OUTPUT_BYTES = 200 * 1024; // 200 KB per stream - plenty for test/build output, caps runaway logs

// No legitimate use inside a coding workspace session - always rejected.
const HARD_BLOCKED_PATTERNS = [
    /\bmkfs(\.\w+)?\b/i,
    /\bformat\s+[a-z]:/i,
    /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // classic fork bomb
    /\brm\s+-rf\s+\/(\s|$)/i,          // rm -rf / (root)
    /\brm\s+-rf\s+\/\*/i,
    /\bdel\s+\/[fsq]+\s+\/[fsq]+\s+c:\\?\s*$/i, // del /f /s /q C:\
    />\s*\/dev\/sd[a-z]\b/i
];

// Destructive/irreversible but legitimately part of normal dev workflows -
// require the caller to pass { confirmed: true } after showing the user
// exactly what will run.
const CONFIRM_REQUIRED_PATTERNS = [
    /\brm\s+-rf\b/i,
    /\brmdir\s+\/s\b/i,
    /\bgit\s+reset\s+--hard\b/i,
    /\bgit\s+clean\s+-f/i,
    /\bgit\s+push\s+(--force|-f)\b/i,
    /\bgit\s+checkout\s+--\s+\./i,
    /\bdrop\s+(table|database)\b/i
];

class TerminalCommandError extends Error {
    constructor(message, code, extra = {}) {
        super(message);
        this.name = "TerminalCommandError";
        this.code = code;
        Object.assign(this, extra);
    }
}

class CodingTerminalService {
    constructor() {
        /** @type {Map<string, import('child_process').ChildProcess>} */
        this._running = new Map();
    }

    classify(command) {
        if (HARD_BLOCKED_PATTERNS.some((p) => p.test(command))) return "blocked";
        if (CONFIRM_REQUIRED_PATTERNS.some((p) => p.test(command))) return "confirm";
        return "allowed";
    }

    /**
     * Runs `command` inside userId's workspace (optionally a subdirectory).
     * Returns { runId, success, exitCode, stdout, stderr, truncated,
     * timedOut, cancelled }. Never throws for a failing command (non-zero
     * exit is a normal, informative result) - only throws for
     * authorization/workspace/classification problems raised before the
     * process is even started.
     */
    run(userId, command, { cwd = ".", timeoutMs = DEFAULT_TIMEOUT_MS, confirmed = false } = {}) {
        if (!command || typeof command !== "string" || !command.trim()) {
            throw new TerminalCommandError("A command is required.", "INVALID_COMMAND");
        }

        const classification = this.classify(command);
        if (classification === "blocked") {
            throw new TerminalCommandError(
                `Command blocked by security policy: "${command}"`,
                "COMMAND_BLOCKED"
            );
        }
        if (classification === "confirm" && !confirmed) {
            throw new TerminalCommandError(
                `This command is destructive and requires explicit confirmation: "${command}"`,
                "CONFIRMATION_REQUIRED"
            );
        }

        // Resolves + validates the cwd is inside the workspace (throws
        // WorkspaceAccessError otherwise - propagated to the caller as-is).
        const absCwd = CodingWorkspaceService.resolveSafe(userId, cwd);

        const boundedTimeout = Math.min(Math.max(1000, timeoutMs || DEFAULT_TIMEOUT_MS), MAX_TIMEOUT_MS);
        const runId = crypto.randomUUID();

        return new Promise((resolve) => {
            const isWindows = process.platform === "win32";
            const child = spawn(command, {
                cwd: absCwd,
                shell: true,
                windowsHide: true,
                // shell:true means `child` is actually the shell process
                // (/bin/sh -c "..."); killing just that PID leaves the
                // real command running as an orphaned grandchild. detached
                // puts the shell in its own process group so we can kill
                // the whole group via a negative PID in _kill().
                detached: process.platform !== "win32",
                env: this._scrubEnv(process.env)
            });

            this._running.set(runId, child);

            let stdout = "";
            let stderr = "";
            let stdoutTruncated = false;
            let stderrTruncated = false;
            let timedOut = false;
            let cancelled = false;

            const timer = setTimeout(() => {
                timedOut = true;
                this._kill(child, isWindows);
            }, boundedTimeout);

            child.stdout?.on("data", (chunk) => {
                if (stdout.length >= MAX_OUTPUT_BYTES) { stdoutTruncated = true; return; }
                stdout += chunk.toString("utf8");
                if (stdout.length > MAX_OUTPUT_BYTES) {
                    stdout = stdout.slice(0, MAX_OUTPUT_BYTES);
                    stdoutTruncated = true;
                }
            });
            child.stderr?.on("data", (chunk) => {
                if (stderr.length >= MAX_OUTPUT_BYTES) { stderrTruncated = true; return; }
                stderr += chunk.toString("utf8");
                if (stderr.length > MAX_OUTPUT_BYTES) {
                    stderr = stderr.slice(0, MAX_OUTPUT_BYTES);
                    stderrTruncated = true;
                }
            });

            child.on("close", (exitCode) => {
                clearTimeout(timer);
                this._running.delete(runId);
                resolve({
                    runId,
                    success: !timedOut && !cancelled && exitCode === 0,
                    exitCode,
                    stdout,
                    stderr,
                    truncated: stdoutTruncated || stderrTruncated,
                    timedOut,
                    cancelled
                });
            });

            child.on("error", (err) => {
                clearTimeout(timer);
                this._running.delete(runId);
                resolve({
                    runId,
                    success: false,
                    exitCode: null,
                    stdout,
                    stderr: stderr + `\n[spawn error] ${err.message}`,
                    truncated: false,
                    timedOut,
                    cancelled
                });
            });

            // Exposed for cancel() to flip the flag before killing.
            child.__markCancelled = () => { cancelled = true; };
        });
    }

    /**
     * Cancels a running command by the runId returned from run(). Returns
     * true if a running process was found and killed, false otherwise
     * (already finished, or unknown id).
     */
    cancel(runId) {
        const child = this._running.get(runId);
        if (!child) return false;
        child.__markCancelled?.();
        this._kill(child, process.platform === "win32");
        return true;
    }

    _kill(child, isWindows) {
        try {
            if (isWindows) {
                spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"]);
            } else {
                // Negative pid = kill the whole process group we detached
                // this child into, so the actual command spawned by the
                // shell wrapper dies too, not just /bin/sh itself.
                process.kill(-child.pid, "SIGKILL");
            }
        } catch {
            // Process may have already exited between the check and the kill.
        }
    }

    // Never leak the Yuna server's own AI provider keys / JWT secret into a
    // child process the coding agent asked to run inside the user's
    // workspace - only pass through a conservative allowlist of harmless
    // environment basics a normal shell/npm command needs.
    _scrubEnv(sourceEnv) {
        const ALLOWLIST_PREFIXES = ["PATH", "HOME", "USERPROFILE", "APPDATA", "TEMP", "TMP", "SHELL", "LANG", "SYSTEMROOT", "WINDIR", "NODE_", "NPM_", "PNPM_", "YARN_"];
        const scrubbed = {};
        for (const [key, value] of Object.entries(sourceEnv)) {
            if (ALLOWLIST_PREFIXES.some((prefix) => key.toUpperCase().startsWith(prefix))) {
                scrubbed[key] = value;
            }
        }
        return scrubbed;
    }
}

module.exports = {
    CodingTerminalService: new CodingTerminalService(),
    TerminalCommandError
};
