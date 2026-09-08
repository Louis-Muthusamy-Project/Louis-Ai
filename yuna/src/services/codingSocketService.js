import SocketService from "./socketService";
import {
    CODING_AGENT_RUN,
    CODING_AGENT_CANCEL,
    CODING_AGENT_RESUME,
    CODING_CAPABILITY_ACTION
} from "../constants/codingEvents";

/**
 * ==========================================
 * CodingSocketService
 * ------------------------------------------
 * Every Coding-panel action goes through here, never a raw
 * SocketService.emit() call from inside a component. Two shapes:
 *
 *   - Long-running agent lifecycle (run/cancel/resume): fire-and-forget,
 *     progress arrives via the CODING_* activity events (see
 *     providers/CodingProvider.jsx), not this call's return value.
 *   - Quick request/response actions (workspace/file/terminal/git/session
 *     listing): ack-based via emitWithAck(), resolves with the real
 *     backend result directly.
 *
 * ownerId/userId is NEVER part of any payload here - the backend derives
 * it exclusively from the authenticated socket connection (see
 * server/socket/socketHandler.js). Nothing in this file could send one
 * even if it tried.
 * ==========================================
 */
class CodingSocketService {
    listProviders() {
        return SocketService.emitWithAck(CODING_CAPABILITY_ACTION, { action: "agent.providers", params: {} });
    }

    runAgent({ task, provider, maxIterations, maxToolCalls, maxRuntimeMs }) {
        SocketService.emit(CODING_AGENT_RUN, { task, provider, maxIterations, maxToolCalls, maxRuntimeMs });
    }

    cancelAgent(sessionId) {
        SocketService.emit(CODING_AGENT_CANCEL, { sessionId });
    }

    resumeAgent({ sessionId, approved, approvalId }) {
        SocketService.emit(CODING_AGENT_RESUME, { sessionId, approved, approvalId });
    }

    // ---- Workspace ----------------------------------------------------

    inspectWorkspace() {
        return this._call("workspace.inspect");
    }

    setWorkspaceRoot(path) {
        return this._call("workspace.setRoot", { path });
    }

    listDirectory(path = ".") {
        return this._call("workspace.list", { path });
    }

    searchWorkspace(query, includeContent = true) {
        return this._call("workspace.search", { query, includeContent });
    }

    // ---- Files ----------------------------------------------------------

    readFile(path, acknowledgeSecret = false) {
        return this._call("file.read", { path, acknowledgeSecret });
    }

    writeFile(path, content, { acknowledgeSecret = false, expectedHash = null } = {}) {
        return this._call("file.write", { path, content, acknowledgeSecret, expectedHash });
    }

    createFile(path, content = "") {
        return this._call("file.create", { path, content });
    }

    deleteFile(path, confirmed = false) {
        return this._call("file.delete", { path, confirmed });
    }

    renameFile(from, to) {
        return this._call("file.rename", { from, to });
    }

    // ---- Terminal ---------------------------------------------------------

    runCommand(command, { cwd, timeoutMs, confirmed = false } = {}) {
        return this._call("terminal.run", { command, cwd, timeoutMs, confirmed });
    }

    cancelCommand(runId) {
        return this._call("terminal.cancel", { runId });
    }

    // ---- Git -------------------------------------------------------------

    gitStatus(cwd) {
        return this._call("git.status", { cwd });
    }

    gitDiff({ file, staged, cwd } = {}) {
        return this._call("git.diff", { file, staged, cwd });
    }

    gitLog({ limit, cwd } = {}) {
        return this._call("git.log", { limit, cwd });
    }

    gitStage(files, cwd) {
        return this._call("git.stage", { files, cwd });
    }

    gitUnstage(files, cwd) {
        return this._call("git.unstage", { files, cwd });
    }

    gitCommit(message, cwd) {
        return this._call("git.commit", { message, cwd });
    }

    gitBranch(cwd) {
        return this._call("git.branch", { cwd });
    }

    // ---- Sessions --------------------------------------------------------

    listSessions(limit) {
        return this._call("agent.sessions.list", { limit });
    }

    getSession(sessionId) {
        return this._call("agent.sessions.get", { sessionId });
    }

    _call(action, params = {}) {
        return SocketService.emitWithAck(CODING_CAPABILITY_ACTION, { action, params });
    }
}

export default new CodingSocketService();
