const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const Kernel = require("../core/Kernel");

/**
 * ==========================================
 * CodingWorkspaceService
 * ------------------------------------------
 * Everything the coding agent (and the Coding panel's manual file/terminal/
 * git tools) touches on disk goes through this module first. It has exactly
 * two jobs, and both are security-critical:
 *
 *   1. Resolve which absolute directory a given authenticated user's coding
 *      workspace actually is (per-user, stored in Settings - never a
 *      client-supplied path taken at face value for tool execution).
 *   2. Turn a relative path the AI/UI asks for into a safe absolute path
 *      that is verified to still be inside that workspace root - blocking
 *      "../../etc/passwd"-style traversal, symlink escapes, and access to
 *      an explicit secret-file blocklist (.env, private keys, credential
 *      files) unless the caller explicitly acknowledges that risk.
 *
 * No other module should call fs.* directly against a coding-agent-supplied
 * path. Route through here instead.
 * ==========================================
 */

// Directories never included in listings/search - noisy and/or huge, never
// something the agent should be reasoning about the contents of.
const EXCLUDED_DIR_NAMES = new Set([
    "node_modules", ".git", "dist", "build", ".next", ".cache",
    "coverage", ".vite", "out", ".turbo", "__pycache__"
]);

// Filename patterns the agent must not read/write without an explicit
// acknowledgeSecret:true on the call - these are exactly the files an
// external AI API (Gemini/OpenAI/Claude) must not silently receive.
const SECRET_PATTERNS = [
    /^\.env(\..+)?$/i,
    /^id_rsa(\.pub)?$/i,
    /^id_ed25519(\.pub)?$/i,
    /\.pem$/i,
    /\.pfx$/i,
    /\.p12$/i,
    /^credentials(\.\w+)?$/i,
    /secrets?\.\w+$/i,
    /^\.npmrc$/i,
    /^\.netrc$/i
];

const MAX_LIST_ENTRIES = 2000;
const MAX_READ_BYTES = 1024 * 1024; // 1 MB - large files should be range-read, not dumped whole
const MAX_SEARCH_RESULTS = 200;

class WorkspaceAccessError extends Error {
    constructor(message, code) {
        super(message);
        this.name = "WorkspaceAccessError";
        this.code = code || "WORKSPACE_ACCESS_DENIED";
    }
}

class CodingWorkspaceService {
    get settingsService() {
        return Kernel.get("settingsService");
    }

    /**
     * The configured workspace root for this user, or null if none is set
     * yet. Never falls back to the Yuna server's own repository root - an
     * unconfigured workspace means "no workspace", not "edit Yuna itself".
     */
    getWorkspaceRoot(userId) {
        if (!userId) {
            throw new WorkspaceAccessError("Workspace access requires an authenticated user.", "NO_USER");
        }
        const settings = this.settingsService.getSettings(userId) || {};
        const configured = settings.codingWorkspace;
        if (!configured || typeof configured !== "string" || !configured.trim()) {
            return null;
        }
        return path.resolve(configured.trim());
    }

    /**
     * Validates and persists a new workspace root for a user. Must be an
     * existing, readable directory - we resolve it to an absolute,
     * normalized path before storing so later scoping checks aren't
     * comparing against a relative or symlinked value.
     */
    setWorkspaceRoot(userId, requestedPath) {
        if (!userId) {
            throw new WorkspaceAccessError("Workspace access requires an authenticated user.", "NO_USER");
        }
        if (!requestedPath || typeof requestedPath !== "string" || !requestedPath.trim()) {
            throw new WorkspaceAccessError("A workspace path is required.", "INVALID_PATH");
        }

        const resolved = fs.realpathSync(path.resolve(requestedPath.trim()));
        const stat = fs.statSync(resolved);
        if (!stat.isDirectory()) {
            throw new WorkspaceAccessError("Workspace path must be a directory.", "NOT_A_DIRECTORY");
        }

        this.settingsService.updateSettings(userId, { codingWorkspace: resolved });
        return resolved;
    }

    /**
     * Resolves a workspace-relative path to an absolute one, guaranteeing
     * the result is still inside the workspace root. This is the single
     * choke point every file/terminal/git tool must call before touching
     * disk. Throws WorkspaceAccessError on any traversal attempt.
     */
    resolveSafe(userId, relativePath = ".") {
        const root = this.getWorkspaceRoot(userId);
        if (!root) {
            throw new WorkspaceAccessError(
                "No coding workspace is configured for this user yet. Set one in Settings first.",
                "NO_WORKSPACE"
            );
        }

        // Reject absolute paths and drive letters outright - only paths
        // relative to the workspace root are accepted from callers (AI
        // args or UI requests alike).
        const normalizedInput = String(relativePath || ".").replace(/\\/g, "/");
        if (path.isAbsolute(normalizedInput) || /^[a-zA-Z]:/.test(normalizedInput)) {
            throw new WorkspaceAccessError("Absolute paths are not allowed - use a path relative to the workspace root.", "ABSOLUTE_PATH_REJECTED");
        }

        const candidate = path.resolve(root, normalizedInput);

        // The classic guard: resolved path must be the root itself or
        // nested under it, checked with a trailing separator so
        // "/workspace-evil" can't falsely match a prefix of "/workspace".
        const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
        if (candidate !== root && !candidate.startsWith(rootWithSep)) {
            throw new WorkspaceAccessError(`Path escapes the workspace root: ${relativePath}`, "PATH_TRAVERSAL_BLOCKED");
        }

        // If the target exists, also resolve symlinks and re-check - a
        // symlink inside the workspace pointing outside it must not be
        // usable as an escape hatch either.
        if (fs.existsSync(candidate)) {
            const real = fs.realpathSync(candidate);
            const realRoot = fs.realpathSync(root);
            const realRootWithSep = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
            if (real !== realRoot && !real.startsWith(realRootWithSep)) {
                throw new WorkspaceAccessError(`Path escapes the workspace root via symlink: ${relativePath}`, "SYMLINK_ESCAPE_BLOCKED");
            }
        }

        return candidate;
    }

    isSecretPath(relativePath) {
        const base = path.basename(String(relativePath || ""));
        return SECRET_PATTERNS.some((pattern) => pattern.test(base));
    }

    _assertNotSecret(relativePath, acknowledgeSecret) {
        if (this.isSecretPath(relativePath) && !acknowledgeSecret) {
            throw new WorkspaceAccessError(
                `Refusing to access likely secret file "${relativePath}" without explicit confirmation.`,
                "SECRET_FILE_BLOCKED"
            );
        }
    }

    // ---- Directory / listing -------------------------------------------------

    inspect(userId) {
        const root = this.getWorkspaceRoot(userId);
        if (!root) {
            return { configured: false, root: null };
        }
        return { configured: true, root, entries: this.list(userId, ".") };
    }

    list(userId, relativePath = ".") {
        const abs = this.resolveSafe(userId, relativePath);
        if (!fs.existsSync(abs)) {
            throw new WorkspaceAccessError(`Path does not exist: ${relativePath}`, "NOT_FOUND");
        }
        const stat = fs.statSync(abs);
        if (!stat.isDirectory()) {
            throw new WorkspaceAccessError(`Not a directory: ${relativePath}`, "NOT_A_DIRECTORY");
        }

        const entries = fs.readdirSync(abs, { withFileTypes: true })
            .filter((entry) => !EXCLUDED_DIR_NAMES.has(entry.name))
            .slice(0, MAX_LIST_ENTRIES)
            .map((entry) => ({
                name: entry.name,
                type: entry.isDirectory() ? "directory" : "file",
                secret: this.isSecretPath(entry.name)
            }));

        return entries;
    }

    // ---- File contents ---------------------------------------------------

    readFile(userId, relativePath, { acknowledgeSecret = false } = {}) {
        this._assertNotSecret(relativePath, acknowledgeSecret);
        const abs = this.resolveSafe(userId, relativePath);
        if (!fs.existsSync(abs)) {
            throw new WorkspaceAccessError(`File does not exist: ${relativePath}`, "NOT_FOUND");
        }
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) {
            throw new WorkspaceAccessError(`Path is a directory, not a file: ${relativePath}`, "IS_A_DIRECTORY");
        }
        if (stat.size > MAX_READ_BYTES) {
            throw new WorkspaceAccessError(
                `File is too large to read in full (${stat.size} bytes). Use a ranged read.`,
                "FILE_TOO_LARGE"
            );
        }
        const content = fs.readFileSync(abs, "utf8");
        return { content, hash: this._hashContent(content) };
    }

    _hashContent(content) {
        return crypto.createHash("sha256").update(content, "utf8").digest("hex");
    }

    /**
     * True optimistic-concurrency conflict detection: if the caller
     * supplies expectedHash (the hash it got back from a prior readFile),
     * and the file's CURRENT on-disk content hashes to something
     * different, the write is rejected with a CONFLICT error instead of
     * silently overwriting whatever changed the file in the meantime
     * (another tab, the agent, an external editor). No expectedHash means
     * no check - used for brand-new files / callers that don't track it
     * (e.g. the coding agent's own tool calls, which don't hold a stale
     * read the way an editor tab does).
     */
    writeFile(userId, relativePath, content, { acknowledgeSecret = false, create = true, expectedHash = null } = {}) {
        this._assertNotSecret(relativePath, acknowledgeSecret);
        if (typeof content !== "string") {
            throw new WorkspaceAccessError("File content must be a string.", "INVALID_CONTENT");
        }
        const abs = this.resolveSafe(userId, relativePath);
        const exists = fs.existsSync(abs);
        if (!exists && !create) {
            throw new WorkspaceAccessError(`File does not exist: ${relativePath}`, "NOT_FOUND");
        }
        if (expectedHash && exists) {
            const currentContent = fs.readFileSync(abs, "utf8");
            const currentHash = this._hashContent(currentContent);
            if (currentHash !== expectedHash) {
                throw new WorkspaceAccessError(
                    `File has changed since it was last read: ${relativePath}`,
                    "CONFLICT"
                );
            }
        }
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, "utf8");
        return { path: relativePath, created: !exists, bytes: Buffer.byteLength(content, "utf8"), hash: this._hashContent(content) };
    }

    deleteFile(userId, relativePath, { acknowledgeSecret = false } = {}) {
        this._assertNotSecret(relativePath, acknowledgeSecret);
        const abs = this.resolveSafe(userId, relativePath);
        if (!fs.existsSync(abs)) {
            throw new WorkspaceAccessError(`Path does not exist: ${relativePath}`, "NOT_FOUND");
        }
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) {
            fs.rmSync(abs, { recursive: true, force: true });
        } else {
            fs.unlinkSync(abs);
        }
        return { path: relativePath, deleted: true };
    }

    renameFile(userId, fromRelativePath, toRelativePath) {
        this._assertNotSecret(fromRelativePath, false);
        this._assertNotSecret(toRelativePath, false);
        const fromAbs = this.resolveSafe(userId, fromRelativePath);
        const toAbs = this.resolveSafe(userId, toRelativePath);
        if (!fs.existsSync(fromAbs)) {
            throw new WorkspaceAccessError(`Path does not exist: ${fromRelativePath}`, "NOT_FOUND");
        }
        fs.mkdirSync(path.dirname(toAbs), { recursive: true });
        fs.renameSync(fromAbs, toAbs);
        return { from: fromRelativePath, to: toRelativePath };
    }

    // ---- Search ------------------------------------------------------------

    /**
     * Filename search (always) plus a bounded content grep (when `query`
     * looks like plain text worth scanning file bodies for). Walks the
     * workspace tree once, skipping excluded/secret paths, capped at
     * MAX_SEARCH_RESULTS so a huge repo can't blow up context/response size.
     */
    search(userId, query, { includeContent = true } = {}) {
        const root = this.getWorkspaceRoot(userId);
        if (!root) {
            throw new WorkspaceAccessError("No coding workspace is configured for this user yet.", "NO_WORKSPACE");
        }
        if (!query || !query.trim()) {
            throw new WorkspaceAccessError("A search query is required.", "INVALID_QUERY");
        }

        const needle = query.trim().toLowerCase();
        const results = [];

        const walk = (dirAbs, dirRel) => {
            if (results.length >= MAX_SEARCH_RESULTS) return;
            let entries;
            try {
                entries = fs.readdirSync(dirAbs, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                if (results.length >= MAX_SEARCH_RESULTS) return;
                if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;

                const entryRel = dirRel ? `${dirRel}/${entry.name}` : entry.name;
                const entryAbs = path.join(dirAbs, entry.name);

                if (entry.isDirectory()) {
                    walk(entryAbs, entryRel);
                    continue;
                }

                if (this.isSecretPath(entry.name)) continue;

                if (entry.name.toLowerCase().includes(needle)) {
                    results.push({ path: entryRel, matchType: "filename" });
                    continue;
                }

                if (includeContent) {
                    try {
                        const stat = fs.statSync(entryAbs);
                        if (stat.size > MAX_READ_BYTES) continue;
                        const content = fs.readFileSync(entryAbs, "utf8");
                        const lineIndex = content.toLowerCase().indexOf(needle);
                        if (lineIndex !== -1) {
                            const lineNumber = content.slice(0, lineIndex).split("\n").length;
                            results.push({ path: entryRel, matchType: "content", line: lineNumber });
                        }
                    } catch {
                        // Binary/unreadable file - skip silently, not a search failure.
                    }
                }
            }
        };

        walk(root, "");
        return results;
    }
}

module.exports = {
    CodingWorkspaceService: new CodingWorkspaceService(),
    WorkspaceAccessError
};
