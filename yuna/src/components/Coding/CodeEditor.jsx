import React, { useState } from "react";
import Editor from "@monaco-editor/react";
import { Tabs, Empty, Spin, Button, App as AntApp } from "antd";
import { SaveOutlined, ReloadOutlined, WarningOutlined } from "@ant-design/icons";

import CodingSocketService from "../../services/codingSocketService";
import useCodingStore from "../../store/codingStore";

import styles from "./codeEditor.module.css";

const LANGUAGE_BY_EXTENSION = {
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript",
    json: "json", css: "css", html: "html", htm: "html",
    md: "markdown", py: "python", yml: "yaml", yaml: "yaml",
    sh: "shell", sql: "sql"
};

function languageFor(path) {
    const ext = path.split(".").pop().toLowerCase();
    return LANGUAGE_BY_EXTENSION[ext] || "plaintext";
}

/**
 * Real Monaco editor with tabs and hash-based conflict detection - saving
 * sends the hash the tab was last synced against (see
 * CodingWorkspaceService.writeFile's expectedHash), and a CONFLICT
 * response means the file changed on disk since this tab last read it
 * (e.g. the agent edited it) - handled by offering reload/overwrite/
 * cancel rather than either silently clobbering the newer version or
 * silently discarding the user's edit.
 */
export default function CodeEditor() {
    const { message, modal } = AntApp.useApp();

    const openTabs = useCodingStore(state => state.openTabs);
    const activeTabPath = useCodingStore(state => state.activeTabPath);
    const [saving, setSaving] = useState(false);

    const activeTab = openTabs.find(t => t.path === activeTabPath);

    async function handleSave() {
        if (!activeTab) return;
        setSaving(true);
        const result = await CodingSocketService.writeFile(
            activeTab.path,
            activeTab.content,
            { expectedHash: activeTab.hash }
        );
        setSaving(false);

        if (!result.success && result.code === "CONFLICT") {
            modal.confirm({
                title: "File changed externally",
                icon: <WarningOutlined />,
                content: `"${activeTab.path}" was modified outside this editor (likely by the AI agent) since you last opened it. Reload the current version, or overwrite it with your changes?`,
                okText: "Overwrite with my changes",
                okButtonProps: { danger: true },
                cancelText: "Reload external version",
                onOk: () => handleSaveConfirmedOverwrite(),
                onCancel: () => handleReload()
            });
            return;
        }

        if (!result.success) {
            message.error(result.message || "Could not save.");
            return;
        }

        useCodingStore.getState().markTabSaved(activeTab.path, activeTab.content, result.hash);
        message.success("Saved.");
    }

    async function handleSaveConfirmedOverwrite() {
        if (!activeTab) return;
        setSaving(true);
        // Re-read the CURRENT hash immediately before writing so this
        // "confirmed overwrite" only fails again if the file changed a
        // SECOND time in the interim - it's not a blind bypass.
        const fresh = await CodingSocketService.readFile(activeTab.path);
        const result = fresh.success
            ? await CodingSocketService.writeFile(activeTab.path, activeTab.content, { expectedHash: fresh.hash })
            : { success: false, message: fresh.message };
        setSaving(false);
        if (!result.success) {
            message.error(result.message || "Could not save.");
            return;
        }
        useCodingStore.getState().markTabSaved(activeTab.path, activeTab.content, result.hash);
        message.success("Saved (overwrote the external change).");
    }

    async function handleReload() {
        if (!activeTab) return;
        const result = await CodingSocketService.readFile(activeTab.path);
        if (!result.success) {
            message.error(result.message || "Could not reload.");
            return;
        }
        useCodingStore.getState().setTabContent(activeTab.path, result.content, result.hash);
        message.info("Reloaded the current version from disk.");
    }

    if (openTabs.length === 0) {
        return (
            <div className={styles.empty}>
                <Empty description="Open a file from the explorer to start editing" />
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Tabs
                type="editable-card"
                hideAdd
                activeKey={activeTabPath}
                onChange={key => useCodingStore.getState().setActiveTab(key)}
                onEdit={(key) => useCodingStore.getState().closeTab(key)}
                items={openTabs.map(tab => ({
                    key: tab.path,
                    label: (
                        <span className={styles.tabLabel}>
                            {tab.externalConflict && <WarningOutlined className={styles.conflictIcon} />}
                            {tab.dirty ? `● ${tab.path.split("/").pop()}` : tab.path.split("/").pop()}
                        </span>
                    )
                }))}
                className={styles.tabs}
            />

            <div className={styles.toolbar}>
                <span className={styles.path}>{activeTab?.path}</span>
                {activeTab?.externalConflict && (
                    <span className={styles.conflictNote}>Changed externally - reload or save to resolve</span>
                )}
                <Button size="small" icon={<ReloadOutlined />} onClick={handleReload} disabled={!activeTab}>
                    Reload
                </Button>
                <Button size="small" type="primary" icon={<SaveOutlined />} loading={saving} disabled={!activeTab || !activeTab.dirty} onClick={() => handleSave()}>
                    Save
                </Button>
            </div>

            <div className={styles.editorArea}>
                {activeTab?.loading && (
                    <div className={styles.loading}><Spin /></div>
                )}
                {activeTab?.error && (
                    <div className={styles.error}>{activeTab.error}</div>
                )}
                {activeTab && !activeTab.loading && !activeTab.error && (
                    <Editor
                        height="100%"
                        theme="vs-dark"
                        language={languageFor(activeTab.path)}
                        value={activeTab.content}
                        onChange={(value) => useCodingStore.getState().editTabContent(activeTab.path, value ?? "")}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            automaticLayout: true,
                            scrollBeyondLastLine: false
                        }}
                    />
                )}
            </div>
        </div>
    );
}
