import { useEffect } from "react";

import SocketService from "../services/socketService";
import useCodingStore from "../store/codingStore";
import {
    CODING_SESSION_START,
    CODING_AGENT_THINKING,
    CODING_TOOL_START,
    CODING_TOOL_RESULT,
    CODING_FILE_CHANGED,
    CODING_TERMINAL_START,
    CODING_TERMINAL_OUTPUT,
    CODING_TERMINAL_COMPLETE,
    CODING_APPROVAL_REQUIRED,
    CODING_AGENT_COMPLETE,
    CODING_AGENT_ERROR,
    CODING_AGENT_CANCELLED
} from "../constants/codingEvents";

/**
 * ==========================================
 * CodingProvider
 * ------------------------------------------
 * Wraps the Coding view only (not the whole app - ChatProvider already
 * owns the socket connection lifecycle for the whole authenticated app).
 * This just subscribes to the CODING_* activity stream while the Coding
 * view is mounted, and tears the listeners down when it isn't - so a user
 * who never opens Coding never pays for these subscriptions, and
 * navigating away and back doesn't accumulate duplicate listeners.
 *
 * Every event payload's `sessionId` is compared against the CURRENTLY
 * tracked session before being applied - a stale event for a session the
 * user has since cancelled/replaced (e.g. a slow terminal:complete that
 * arrives after cancel) is dropped rather than corrupting the visible
 * state of a newer run.
 * ==========================================
 */
export default function CodingProvider({ children }) {

    useEffect(() => {

        const store = () => useCodingStore.getState();

        const isCurrent = (sessionId) => {
            const current = store().session;
            return current && current.sessionId === sessionId;
        };

        const onSessionStart = (data) => {
            store().startSession({ sessionId: data.sessionId, task: data.task, provider: data.provider });
        };

        const onThinking = (data) => {
            if (!isCurrent(data.sessionId)) return;
            store().incrementIteration();
            store().appendActivity({ event: "thinking", iteration: data.iteration });
        };

        const onToolStart = (data) => {
            if (!isCurrent(data.sessionId)) return;
            store().appendActivity({ event: "tool_start", tool: data.tool, args: data.args });
        };

        const onToolResult = (data) => {
            if (!isCurrent(data.sessionId)) return;
            store().appendActivity({ event: "tool_result", tool: data.tool, success: data.success, summary: data.summary });
        };

        const onFileChanged = (data) => {
            if (!isCurrent(data.sessionId)) return;
            store().addChangedFile(data.path);
            store().markFileChangedExternally(data.path);
            store().appendActivity({ event: "file_changed", path: data.path, operation: data.operation });
        };

        const onTerminalStart = (data) => {
            if (!isCurrent(data.sessionId)) return;
            store().startTerminalEntry(data.sessionId + ":" + Date.now(), data.command);
            store().appendActivity({ event: "terminal_start", command: data.command });
        };

        const onTerminalOutput = (data) => {
            if (!isCurrent(data.sessionId)) return;
            const history = store().terminalHistory;
            const last = history[history.length - 1];
            if (last && last.running) {
                store().appendTerminalOutput(last.id, { stdout: data.stdout, stderr: data.stderr });
            }
        };

        const onTerminalComplete = (data) => {
            if (!isCurrent(data.sessionId)) return;
            const history = store().terminalHistory;
            const last = history[history.length - 1];
            if (last && last.running) {
                store().completeTerminalEntry(last.id, { exitCode: data.exitCode, success: data.success, timedOut: data.timedOut });
            }
            store().appendActivity({ event: "terminal_complete", exitCode: data.exitCode, success: data.success });
        };

        const onApprovalRequired = (data) => {
            if (!isCurrent(data.sessionId)) return;
            store().setPendingApproval({
                approvalId: data.approvalId,
                sessionId: data.sessionId,
                tool: data.tool,
                args: data.args,
                reason: data.reason,
                message: data.message
            });
            store().appendActivity({ event: "approval_required", tool: data.tool, message: data.message });
        };

        const onComplete = (data) => {
            if (!isCurrent(data.sessionId)) return;
            store().finishSession(data.state || "COMPLETED", data.message);
            store().appendActivity({ event: "complete", message: data.message });
        };

        const onError = (data) => {
            if (!isCurrent(data.sessionId)) return;
            store().finishSession("FAILED", data.message);
            store().appendActivity({ event: "error", message: data.message });
        };

        const onCancelled = (data) => {
            if (!isCurrent(data.sessionId)) return;
            store().finishSession("CANCELLED", data.message);
            store().appendActivity({ event: "cancelled", message: data.message });
        };

        SocketService.on(CODING_SESSION_START, onSessionStart);
        SocketService.on(CODING_AGENT_THINKING, onThinking);
        SocketService.on(CODING_TOOL_START, onToolStart);
        SocketService.on(CODING_TOOL_RESULT, onToolResult);
        SocketService.on(CODING_FILE_CHANGED, onFileChanged);
        SocketService.on(CODING_TERMINAL_START, onTerminalStart);
        SocketService.on(CODING_TERMINAL_OUTPUT, onTerminalOutput);
        SocketService.on(CODING_TERMINAL_COMPLETE, onTerminalComplete);
        SocketService.on(CODING_APPROVAL_REQUIRED, onApprovalRequired);
        SocketService.on(CODING_AGENT_COMPLETE, onComplete);
        SocketService.on(CODING_AGENT_ERROR, onError);
        SocketService.on(CODING_AGENT_CANCELLED, onCancelled);

        return () => {
            SocketService.off(CODING_SESSION_START, onSessionStart);
            SocketService.off(CODING_AGENT_THINKING, onThinking);
            SocketService.off(CODING_TOOL_START, onToolStart);
            SocketService.off(CODING_TOOL_RESULT, onToolResult);
            SocketService.off(CODING_FILE_CHANGED, onFileChanged);
            SocketService.off(CODING_TERMINAL_START, onTerminalStart);
            SocketService.off(CODING_TERMINAL_OUTPUT, onTerminalOutput);
            SocketService.off(CODING_TERMINAL_COMPLETE, onTerminalComplete);
            SocketService.off(CODING_APPROVAL_REQUIRED, onApprovalRequired);
            SocketService.off(CODING_AGENT_COMPLETE, onComplete);
            SocketService.off(CODING_AGENT_ERROR, onError);
            SocketService.off(CODING_AGENT_CANCELLED, onCancelled);
        };

    }, []);

    return children;
}
