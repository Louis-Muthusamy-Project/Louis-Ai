import React, { useState } from "react";
import { Select, Button, Input, Tag, Tooltip, App as AntApp } from "antd";
import { PlayCircleOutlined, StopOutlined, FolderOpenOutlined, HistoryOutlined } from "@ant-design/icons";

import CodingSocketService from "../../services/codingSocketService";
import useCodingStore from "../../store/codingStore";

import styles from "./workspaceBar.module.css";

/**
 * The top bar of the Coding view: workspace root, provider selector
 * (real, backend-derived enabled/disabled state - never hardcoded), and
 * the Run/Stop controls for the agent. Every action here calls the real
 * backend through CodingSocketService; nothing is simulated.
 */
export default function WorkspaceBar({ task, onOpenHistory }) {
    const { message } = AntApp.useApp();

    const workspace = useCodingStore(state => state.workspace);
    const workspaceLoading = useCodingStore(state => state.workspaceLoading);
    const providers = useCodingStore(state => state.providers);
    const providersLoading = useCodingStore(state => state.providersLoading);
    const selectedProvider = useCodingStore(state => state.selectedProvider);
    const setSelectedProvider = useCodingStore(state => state.setSelectedProvider);
    const session = useCodingStore(state => state.session);

    const [workspacePathInput, setWorkspacePathInput] = useState("");
    const [settingWorkspace, setSettingWorkspace] = useState(false);
    const [starting, setStarting] = useState(false);

    // `starting` only matters in the brief window before a real session
    // exists - once one does, its own state governs `running` and the
    // flag becomes moot (the defensive setTimeout in handleRun eventually
    // clears it either way, without needing an effect to sync it here).
    const running = (starting && !session) || (session && (session.state === "RUNNING" || session.state === "WAITING_FOR_APPROVAL"));

    async function handleSetWorkspace() {
        const path = workspacePathInput.trim();
        if (!path) return;
        setSettingWorkspace(true);
        const result = await CodingSocketService.setWorkspaceRoot(path);
        setSettingWorkspace(false);
        if (!result.success) {
            message.error(result.message || "Could not set workspace.");
            return;
        }
        useCodingStore.getState().setWorkspace({ configured: true, root: result.root });
        useCodingStore.getState().setDirEntries(".", []); // force a fresh root listing
        setWorkspacePathInput("");
        message.success("Workspace set.");
    }

    function handleRun() {
        if (!task || !task.trim()) {
            message.warning("Describe a task for the agent first.");
            return;
        }
        if (!selectedProvider) {
            message.warning("Choose a configured AI provider first.");
            return;
        }
        if (!workspace.configured) {
            message.warning("Set a workspace before running the agent.");
            return;
        }
        if (running) return; // already starting or running - ignore a rapid double-click
        setStarting(true);
        CodingSocketService.runAgent({ task: task.trim(), provider: selectedProvider });
        // Defensive: if the backend never actually starts a session (e.g.
        // dropped connection right after emit), don't leave the button
        // stuck disabled forever.
        setTimeout(() => setStarting(false), 15000);
    }

    function handleStop() {
        if (!session) return;
        CodingSocketService.cancelAgent(session.sessionId);
    }

    return (
        <div className={styles.bar}>
            <div className={styles.workspaceGroup}>
                <FolderOpenOutlined className={styles.icon} />
                {workspace.configured ? (
                    <Tooltip title={workspace.root}>
                        <span className={styles.workspacePath}>{workspace.root}</span>
                    </Tooltip>
                ) : (
                    <span className={styles.workspaceUnset}>No workspace set</span>
                )}
                <Input
                    size="small"
                    placeholder="/path/to/project"
                    value={workspacePathInput}
                    onChange={e => setWorkspacePathInput(e.target.value)}
                    onPressEnter={handleSetWorkspace}
                    className={styles.workspaceInput}
                    disabled={workspaceLoading}
                />
                <Button size="small" loading={settingWorkspace} onClick={handleSetWorkspace}>
                    {workspace.configured ? "Change" : "Set"}
                </Button>
            </div>

            <div className={styles.providerGroup}>
                <Select
                    size="small"
                    className={styles.providerSelect}
                    loading={providersLoading}
                    value={selectedProvider}
                    placeholder="Select provider"
                    onChange={setSelectedProvider}
                    disabled={running}
                    options={providers.map(p => ({
                        value: p.name,
                        label: p.enabled ? `${p.label} (${p.model || "configured"})` : `${p.label} — ${p.reason}`,
                        disabled: !p.enabled
                    }))}
                />
            </div>

            <div className={styles.actions}>
                <Tooltip title="Session history">
                    <Button size="small" icon={<HistoryOutlined />} onClick={onOpenHistory} />
                </Tooltip>
                {running ? (
                    <Button danger size="small" icon={<StopOutlined />} onClick={handleStop}>
                        Stop
                    </Button>
                ) : (
                    <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={handleRun}>
                        Run Agent
                    </Button>
                )}
                {session && (
                    <Tag color={stateColor(session.state)}>{session.state}</Tag>
                )}
            </div>
        </div>
    );
}

function stateColor(state) {
    switch (state) {
        case "RUNNING": return "processing";
        case "WAITING_FOR_APPROVAL": return "warning";
        case "COMPLETED": return "success";
        case "FAILED": return "error";
        case "CANCELLED": return "default";
        case "LIMIT_REACHED": return "warning";
        default: return "default";
    }
}
