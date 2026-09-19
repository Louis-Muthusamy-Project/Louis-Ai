import React, { useEffect, useState, useCallback } from "react";

import CodingProvider from "../../providers/CodingProvider";
import CodingSocketService from "../../services/codingSocketService";
import useCodingStore from "../../store/codingStore";
import useResizablePanel from "../../hooks/useResizablePanel";

import WorkspaceBar from "../../components/Coding/WorkspaceBar";
import ActivityBar from "../../components/Coding/ActivityBar";
import FileExplorer from "../../components/Coding/FileExplorer";
import SearchPanel from "../../components/Coding/SearchPanel";
import GitPanel from "../../components/Coding/GitPanel";
import CodeEditor from "../../components/Coding/CodeEditor";
import AgentPanel from "../../components/Coding/AgentPanel";
import BottomPanel from "../../components/Coding/BottomPanel";
import SessionHistory from "../../components/Coding/SessionHistory";
import ApprovalDialog from "../../components/Coding/ApprovalDialog";
import ResizeHandle from "../../components/Coding/ResizeHandle";

import styles from "./codingView.module.css";

const SIDE_PANEL_LABEL = { explorer: "Explorer", search: "Search", git: "Source Control" };

/**
 * ==========================================
 * CodingView
 * ------------------------------------------
 * A real VS Code/Antigravity-style IDE layout: a narrow Activity Bar on
 * the left drives ONE docked side panel at a time (Explorer/Search/
 * Source Control), Monaco is the persistent center, a resizable AI panel
 * sits on the right (independently toggled by the Agent icon - it is not
 * part of the "one side panel" mutual-exclusion group, since the agent's
 * activity feed is meant to stay visible alongside whichever side panel
 * is open), and a collapsible bottom panel (Terminal/Problems/Output/
 * Debug Console/Ports) is independently toggled by the Terminal icon.
 * History is a Drawer overlay (see SessionHistory's own doc comment -
 * it's a session list/detail view, not a dockable panel), toggled by the
 * History icon.
 *
 * Every child component here already talks to the real backend through
 * CodingSocketService/codingStore - this view only owns layout/panel-
 * visibility state, never data. CodingProvider wraps everything so the
 * CODING_* activity stream is only subscribed to while this view is
 * mounted.
 * ==========================================
 */
function CodingViewInner() {
    const workspace = useCodingStore(state => state.workspace);
    const activity = useCodingStore(state => state.activity);
    const [task, setTask] = useState("");

    // ---- Panel visibility ------------------------------------------------
    // activeSidePanel: "explorer" | "search" | "git" | null - mutually
    // exclusive, one at a time (see handleActivityClick).
    const [activeSidePanel, setActiveSidePanel] = useState("explorer");
    const [agentPanelOpen, setAgentPanelOpen] = useState(true);
    const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
    const [bottomPanelTab, setBottomPanelTab] = useState("terminal");
    const [historyOpen, setHistoryOpen] = useState(false);

    // Real drag-to-resize, not fixed-width panels - sizes persist per-user
    // across reloads (see useResizablePanel's doc comment).
    const sideResize = useResizablePanel({
        storageKey: "yuna:coding:sideWidth",
        defaultWidth: 260,
        min: 180,
        max: 480,
        direction: "right"
    });
    const agentResize = useResizablePanel({
        storageKey: "yuna:coding:agentWidth",
        defaultWidth: 340,
        min: 260,
        max: 640,
        direction: "left"
    });
    const bottomResize = useResizablePanel({
        storageKey: "yuna:coding:bottomHeight",
        defaultWidth: 240,
        min: 120,
        max: 560,
        direction: "left",
        orientation: "vertical"
    });

    useEffect(() => {
        let cancelled = false;

        (async () => {
            useCodingStore.getState().setWorkspaceLoading(true);
            const workspaceResult = await CodingSocketService.inspectWorkspace();
            if (!cancelled) {
                useCodingStore.getState().setWorkspaceLoading(false);
                if (workspaceResult.success) {
                    // ONE merge with everything the backend actually returned
                    // (configured/root/entries) - see codingStore.setWorkspace's
                    // own doc comment for why this must never be split into
                    // multiple calls that only carry a subset of the fields.
                    useCodingStore.getState().setWorkspace({
                        configured: workspaceResult.configured,
                        root: workspaceResult.root,
                        entries: workspaceResult.entries
                    });
                } else {
                    useCodingStore.getState().setWorkspaceError(workspaceResult.message || "Could not load workspace.");
                }
            }

            useCodingStore.getState().setProvidersLoading(true);
            const providersResult = await CodingSocketService.listProviders();
            if (!cancelled && providersResult.success) {
                useCodingStore.getState().setProviders(providersResult.providers || []);
            } else if (!cancelled) {
                useCodingStore.getState().setProvidersLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const handleActivityClick = useCallback((key) => {
        if (key === "agent") {
            setAgentPanelOpen(open => !open);
            return;
        }
        if (key === "terminal") {
            setBottomPanelOpen(open => {
                if (open && bottomPanelTab === "terminal") return false;
                setBottomPanelTab("terminal");
                return true;
            });
            return;
        }
        if (key === "history") {
            setHistoryOpen(open => !open);
            return;
        }
        // explorer/search/git - only one of these three is ever open
        setActiveSidePanel(current => (current === key ? null : key));
    }, [bottomPanelTab]);

    // Keyboard shortcuts - document-level, cleaned up on unmount. None of
    // these combinations are Monaco/browser defaults, so normal editing
    // (Ctrl+C/V/Z, Monaco's own Ctrl+Shift+P command palette, etc.) is
    // untouched; Escape only acts (and only then calls preventDefault)
    // when a panel this view owns is actually open, so it never swallows
    // an unrelated Escape (e.g. closing a Monaco autocomplete popup).
    useEffect(() => {
        function onKeyDown(e) {
            if (e.ctrlKey && e.shiftKey) {
                const key = e.key.toLowerCase();
                if (key === "e") { e.preventDefault(); handleActivityClick("explorer"); return; }
                if (key === "g") { e.preventDefault(); handleActivityClick("git"); return; }
                if (key === "a") { e.preventDefault(); handleActivityClick("agent"); return; }
                if (key === "h") { e.preventDefault(); handleActivityClick("history"); return; }
                if (key === "`" || key === "~") { e.preventDefault(); handleActivityClick("terminal"); return; }
                return;
            }
            if (e.key === "Escape") {
                if (activeSidePanel) { e.preventDefault(); setActiveSidePanel(null); return; }
                if (historyOpen) { e.preventDefault(); setHistoryOpen(false); return; }
                if (bottomPanelOpen) { e.preventDefault(); setBottomPanelOpen(false); }
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [activeSidePanel, historyOpen, bottomPanelOpen, handleActivityClick]);

    const activeIcons = new Set([
        activeSidePanel,
        agentPanelOpen ? "agent" : null,
        (bottomPanelOpen && bottomPanelTab === "terminal") ? "terminal" : null,
        historyOpen ? "history" : null
    ].filter(Boolean));

    // A running/waiting session, or unread completion/error/approval, is
    // worth flagging on the Agent icon when that panel is currently closed.
    const agentHasActivity = activity.length > 0 && !agentPanelOpen;

    return (
        <div className={styles.root}>
            <WorkspaceBar task={task} onOpenHistory={() => setHistoryOpen(true)} />

            <div className={styles.body}>
                <ActivityBar active={activeIcons} onSelect={handleActivityClick} agentHasActivity={agentHasActivity} />

                {activeSidePanel && (
                    <>
                        <div className={styles.sidePanel} style={{ width: sideResize.width }}>
                            <div className={styles.sidePanelHeader}>{SIDE_PANEL_LABEL[activeSidePanel]}</div>
                            <div className={styles.sidePanelBody}>
                                {activeSidePanel === "explorer" && <FileExplorer />}
                                {activeSidePanel === "search" && <SearchPanel />}
                                {activeSidePanel === "git" && <GitPanel />}
                            </div>
                        </div>
                        <ResizeHandle onMouseDown={sideResize.onMouseDown} isResizing={sideResize.isResizing} />
                    </>
                )}

                <div className={styles.centerColumn}>
                    <div className={styles.editorArea}>
                        {workspace.configured ? (
                            <CodeEditor />
                        ) : (
                            <div className={styles.emptyState}>
                                <p>Set a workspace folder above to start editing.</p>
                            </div>
                        )}
                    </div>

                    {bottomPanelOpen && (
                        <>
                            <ResizeHandle orientation="vertical" onMouseDown={bottomResize.onMouseDown} isResizing={bottomResize.isResizing} />
                            <div className={styles.bottomPanelWrap} style={{ height: bottomResize.height }}>
                                <BottomPanel
                                    activeTab={bottomPanelTab}
                                    onTabChange={setBottomPanelTab}
                                    onClose={() => setBottomPanelOpen(false)}
                                />
                            </div>
                        </>
                    )}
                </div>

                {agentPanelOpen && (
                    <>
                        <ResizeHandle onMouseDown={agentResize.onMouseDown} isResizing={agentResize.isResizing} />
                        <div className={styles.agentPanel} style={{ width: agentResize.width }}>
                            <AgentPanel task={task} onTaskChange={setTask} />
                        </div>
                    </>
                )}
            </div>

            <SessionHistory open={historyOpen} onClose={() => setHistoryOpen(false)} />
            <ApprovalDialog />
        </div>
    );
}

export default function CodingView() {
    return (
        <CodingProvider>
            <CodingViewInner />
        </CodingProvider>
    );
}
