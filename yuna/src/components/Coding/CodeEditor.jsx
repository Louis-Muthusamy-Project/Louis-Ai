import React, { useState, useRef, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { Tabs, Empty, Spin, Button, Switch, App as AntApp } from "antd";
import { SaveOutlined, CheckCircleOutlined, SyncOutlined } from "@ant-design/icons";

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

const AUTO_SAVE_DELAY_MS = 1200;
const AUTO_SAVE_PREF_KEY = "yuna:coding:autoSave";

function languageFor(path) {
    const ext = path.split(".").pop().toLowerCase();
    return LANGUAGE_BY_EXTENSION[ext] || "plaintext";
}

/**
 * Real Monaco editor with tabs and hash-based conflict detection.
 *
 * Auto-save (on by default, toggleable) writes a file to disk shortly
 * after you stop typing - see AUTO_SAVE_DELAY_MS - so there is no manual
 * Save step and no "reload from disk" prompt to interrupt you: on a
 * write conflict (the file changed on disk since this tab last read it -
 * e.g. the agent edited it mid-session) the current buffer is simply
 * re-saved over it, since your own typing is what auto-save exists to
 * keep on disk. You still get a brief, non-blocking notice when that
 * happens, so it's never silent - just never a blocking dialog.
 *
 * With auto-save off, a manual Save button appears instead - conflicts
 * there resolve the same way (re-save over the external change), just on
 * your own click instead of automatically.
 */
export default function CodeEditor() {
    const { message } = AntApp.useApp();

    const openTabs = useCodingStore(state => state.openTabs);
    const activeTabPath = useCodingStore(state => state.activeTabPath);
    const pendingReveal = useCodingStore(state => state.pendingReveal);
    const [saveStatus, setSaveStatus] = useState({}); // {[path]: "saving"|"saved"|null}
    const [autoSave, setAutoSave] = useState(() => {
        if (typeof window === "undefined") return true;
        const stored = window.localStorage.getItem(AUTO_SAVE_PREF_KEY);
        return stored === null ? true : stored === "true";
    });
    const editorRef = useRef(null);
    const saveTimers = useRef({});

    const activeTab = openTabs.find(t => t.path === activeTabPath);

    useEffect(() => {
        try { window.localStorage.setItem(AUTO_SAVE_PREF_KEY, String(autoSave)); } catch { /* best-effort only */ }
    }, [autoSave]);

    // Search-result navigation (see SearchPanel/openFile.js's revealLine):
    // once the target file's tab has actually finished loading, scroll
    // Monaco to and select the matching line, then clear the request so
    // it doesn't re-fire on unrelated re-renders.
    useEffect(() => {
        if (!pendingReveal || !editorRef.current) return;
        if (pendingReveal.path !== activeTabPath) return;
        if (!activeTab || activeTab.loading || activeTab.error) return;

        const editor = editorRef.current;
        const line = pendingReveal.line;
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column: 1 });
        editor.focus();
        useCodingStore.getState().clearPendingReveal();
    }, [pendingReveal, activeTabPath, activeTab]);

    // Cancel any pending auto-save timers on unmount so a save never fires
    // for a component/tab that's already gone.
    useEffect(() => () => {
        Object.values(saveTimers.current).forEach(clearTimeout);
    }, []);

    const saveFile = useCallback(async (tab) => {
        if (!tab) return;
        setSaveStatus(prev => ({ ...prev, [tab.path]: "saving" }));

        let result = await CodingSocketService.writeFile(tab.path, tab.content, { expectedHash: tab.hash });

        if (!result.success && result.code === "CONFLICT") {
            // No reload prompt - the file changed on disk (most likely the
            // agent editing it), but the buffer the user is actively
            // typing into is what auto-save exists to persist, so re-save
            // over it. A fresh hash is read first so this only overwrites
            // ONE external change, not an unbounded blind clobber.
            const fresh = await CodingSocketService.readFile(tab.path);
            result = fresh.success
                ? await CodingSocketService.writeFile(tab.path, tab.content, { expectedHash: fresh.hash })
                : { success: false, message: fresh.message };
            if (result.success) {
                message.info(`"${tab.path.split("/").pop()}" changed on disk (likely the agent) - your version was saved over it.`);
            }
        }

        if (!result.success) {
            setSaveStatus(prev => ({ ...prev, [tab.path]: null }));
            message.error(result.message || "Could not save.");
            return;
        }

        useCodingStore.getState().markTabSaved(tab.path, tab.content, result.hash);
        setSaveStatus(prev => ({ ...prev, [tab.path]: "saved" }));
    }, [message]);

    function handleEditorChange(path, value) {
        useCodingStore.getState().editTabContent(path, value ?? "");
        if (!autoSave) return;

        clearTimeout(saveTimers.current[path]);
        saveTimers.current[path] = setTimeout(() => {
            const tab = useCodingStore.getState().openTabs.find(t => t.path === path);
            if (tab && tab.dirty) saveFile(tab);
        }, AUTO_SAVE_DELAY_MS);
    }

    if (openTabs.length === 0) {
        return (
            <div className={styles.empty}>
                <Empty description="Open a file from the explorer to start editing" />
            </div>
        );
    }

    const status = activeTab ? saveStatus[activeTab.path] : null;

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
                            {tab.dirty ? `● ${tab.path.split("/").pop()}` : tab.path.split("/").pop()}
                        </span>
                    )
                }))}
                className={styles.tabs}
            />

            <div className={styles.toolbar}>
                <span className={styles.path}>{activeTab?.path}</span>
                <span className={styles.saveStatus}>
                    {status === "saving" && <><SyncOutlined spin /> Saving…</>}
                    {status === "saved" && !activeTab?.dirty && <><CheckCircleOutlined /> Saved</>}
                </span>
                <span className={styles.autoSaveToggle}>
                    <Switch size="small" checked={autoSave} onChange={setAutoSave} />
                    Auto-save
                </span>
                {!autoSave && (
                    <Button
                        size="small"
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={status === "saving"}
                        disabled={!activeTab || !activeTab.dirty}
                        onClick={() => saveFile(activeTab)}
                    >
                        Save
                    </Button>
                )}
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
                        onMount={(editor) => { editorRef.current = editor; }}
                        onChange={(value) => handleEditorChange(activeTab.path, value)}
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
