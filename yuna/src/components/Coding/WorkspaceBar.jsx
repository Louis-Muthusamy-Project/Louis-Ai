import React, { useState, useEffect } from "react";
import { Select, Button, Input, Tag, Tooltip, App as AntApp } from "antd";
import { PlayCircleOutlined, StopOutlined, FolderOpenOutlined, HistoryOutlined } from "@ant-design/icons";

import CodingSocketService from "../../services/codingSocketService";
import useCodingStore from "../../store/codingStore";
import useCodingAgentRunner from "../../hooks/useCodingAgentRunner";

import styles from "./workspaceBar.module.css";

/**
 * The top bar of the Coding view: workspace root, AI Model selector, and
 * the Run/Stop controls for the agent (also duplicated, deliberately, in
 * AgentPanel's own composer - see useCodingAgentRunner for the one real
 * implementation both call). Every action here calls the real backend
 * through CodingSocketService; nothing is simulated.
 *
 * The AI Model dropdown lists every ACTUAL model available for each
 * enabled provider's linked API key (see CodingSocketService.
 * listProviderModels / CodingProviderRegistry.listModelsForProvider) -
 * never a hardcoded catalog, and a provider with no key configured never
 * shows any models at all (it's what the entire architecture is built
 * around: one key per provider serving every model that key can use, all
 * configured from Settings -> AI Providers, never from this dropdown).
 */
export default function WorkspaceBar({ task, onOpenHistory }) {
    const { message } = AntApp.useApp();

    const workspace = useCodingStore(state => state.workspace);
    const workspaceLoading = useCodingStore(state => state.workspaceLoading);
    const providers = useCodingStore(state => state.providers);
    const providersLoading = useCodingStore(state => state.providersLoading);
    const selectedProvider = useCodingStore(state => state.selectedProvider);
    const selectedModel = useCodingStore(state => state.selectedModel);
    const modelsByProvider = useCodingStore(state => state.modelsByProvider);

    const { running, session, handleRun, handleStop } = useCodingAgentRunner(task);

    const [workspacePathInput, setWorkspacePathInput] = useState("");
    const [settingWorkspace, setSettingWorkspace] = useState(false);

    // Lazily fetch each enabled provider's real model list, once, the
    // first time providers become known/enabled - not on every render.
    useEffect(() => {
        for (const p of providers) {
            if (!p.enabled) continue;
            const cached = modelsByProvider[p.name];
            if (cached && (cached.loading || cached.models.length > 0 || cached.error)) continue;
            useCodingStore.getState().setModelsLoading(p.name);
            CodingSocketService.listProviderModels(p.name).then((result) => {
                if (result.success) {
                    useCodingStore.getState().setModelsForProvider(p.name, result.models || []);
                    // Default to the first real model once this provider's
                    // list arrives, if this provider is selected and nothing
                    // is chosen yet.
                    const state = useCodingStore.getState();
                    if (state.selectedProvider === p.name && !state.selectedModel && (result.models || []).length > 0) {
                        state.setSelectedModel(result.models[0].id);
                    }
                } else {
                    useCodingStore.getState().setModelsError(p.name, result.message || "Could not list models.");
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [providers]);

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

    function handleModelChange(value) {
        const [provider, ...rest] = value.split("::");
        const modelId = rest.join("::"); // rejoin in the rare case a model id itself contains "::"
        useCodingStore.getState().setSelectedProvider(provider);
        useCodingStore.getState().setSelectedModel(modelId);
    }

    const modelValue = selectedProvider && selectedModel ? `${selectedProvider}::${selectedModel}` : undefined;
    const modelOptions = providers.map(p => {
        if (!p.enabled) {
            return {
                label: p.label,
                title: p.label,
                options: [{ value: `${p.name}::__disabled__`, label: `${p.label} — ${p.reason}`, disabled: true }]
            };
        }
        const entry = modelsByProvider[p.name];
        if (!entry || entry.loading) {
            return {
                label: p.label,
                title: p.label,
                options: [{ value: `${p.name}::__loading__`, label: "Loading models…", disabled: true }]
            };
        }
        if (entry.error) {
            return {
                label: p.label,
                title: p.label,
                options: [{ value: `${p.name}::__error__`, label: `Could not load models: ${entry.error}`, disabled: true }]
            };
        }
        if (entry.models.length === 0) {
            return {
                label: p.label,
                title: p.label,
                options: [{ value: `${p.name}::__none__`, label: "No models available", disabled: true }]
            };
        }
        return {
            label: p.label,
            title: p.label,
            options: entry.models.map(m => ({ value: `${p.name}::${m.id}`, label: m.label }))
        };
    });

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
                <span className={styles.providerLabel}>AI Model</span>
                <Select
                    size="small"
                    className={styles.providerSelect}
                    loading={providersLoading}
                    value={modelValue}
                    placeholder="Select a model"
                    onChange={handleModelChange}
                    disabled={running}
                    options={modelOptions}
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
