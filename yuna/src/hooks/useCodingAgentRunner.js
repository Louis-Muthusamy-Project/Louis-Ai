import { useState } from "react";
import { App as AntApp } from "antd";

import CodingSocketService from "../services/codingSocketService";
import useCodingStore from "../store/codingStore";

/**
 * The one real implementation of "start/stop the Coding Agent" - used by
 * both WorkspaceBar's top-bar Run/Stop button and AgentPanel's own
 * composer Run/Stop button (see the Coding IDE's "Run Agent" requirement
 * in both places), so there is exactly one code path that actually calls
 * CodingSocketService.runAgent/cancelAgent, never two independent copies
 * that could drift out of sync.
 */
export default function useCodingAgentRunner(task) {
    const { message } = AntApp.useApp();

    const workspace = useCodingStore(state => state.workspace);
    const selectedProvider = useCodingStore(state => state.selectedProvider);
    const selectedModel = useCodingStore(state => state.selectedModel);
    const session = useCodingStore(state => state.session);
    const [starting, setStarting] = useState(false);

    // `starting` only matters in the brief window before a real session
    // exists - once one does, its own state governs `running` and the
    // flag becomes moot (the defensive setTimeout below eventually clears
    // it either way, without needing an effect to sync it here).
    const running = (starting && !session) || (session && (session.state === "RUNNING" || session.state === "WAITING_FOR_APPROVAL"));

    function handleRun() {
        if (!task || !task.trim()) {
            message.warning("Describe a task for the agent first.");
            return;
        }
        if (!selectedProvider || !selectedModel) {
            message.warning("Choose an AI model first.");
            return;
        }
        if (!workspace.configured) {
            message.warning("Set a workspace before running the agent.");
            return;
        }
        if (running) return; // already starting or running - ignore a rapid double-click
        setStarting(true);
        CodingSocketService.runAgent({ task: task.trim(), provider: selectedProvider, model: selectedModel });
        // Defensive: if the backend never actually starts a session (e.g.
        // dropped connection right after emit), don't leave the button
        // stuck disabled forever.
        setTimeout(() => setStarting(false), 15000);
    }

    function handleStop() {
        if (!session) return;
        CodingSocketService.cancelAgent(session.sessionId);
    }

    return { running, session, handleRun, handleStop };
}
