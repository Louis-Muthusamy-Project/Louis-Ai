import React, { useEffect, useState } from "react";
import { Tabs } from "antd";
import {
    RobotOutlined, CodeOutlined, CodeSandboxOutlined, BranchesOutlined
} from "@ant-design/icons";

import CodingProvider from "../../providers/CodingProvider";
import CodingSocketService from "../../services/codingSocketService";
import useCodingStore from "../../store/codingStore";

import WorkspaceBar from "../../components/Coding/WorkspaceBar";
import FileExplorer from "../../components/Coding/FileExplorer";
import CodeEditor from "../../components/Coding/CodeEditor";
import AgentPanel from "../../components/Coding/AgentPanel";
import TerminalPanel from "../../components/Coding/TerminalPanel";
import GitPanel from "../../components/Coding/GitPanel";
import SessionHistory from "../../components/Coding/SessionHistory";
import ApprovalDialog from "../../components/Coding/ApprovalDialog";

import styles from "./codingView.module.css";

/**
 * ==========================================
 * CodingView
 * ------------------------------------------
 * The real Coding workspace: file explorer + Monaco editor on the left/
 * center, and a tabbed Agent / Terminal / Git panel on the right, under
 * a WorkspaceBar that owns provider selection and Run/Stop. This is the
 * integration point that was previously missing - every child component
 * here already existed and already talks to the real backend through
 * CodingSocketService/codingStore; this view only wires them together.
 *
 * CodingProvider wraps everything so the CODING_* activity stream is
 * only subscribed to while this view is mounted (see CodingProvider's
 * own doc comment) - leaving the Coding tab tears the listeners down.
 *
 * On mount, this loads the current workspace root and the real
 * (backend-derived) provider list - nothing here is hardcoded, a
 * provider with no configured API key comes back disabled from the
 * server (see server/providers/ProviderManager.js) and WorkspaceBar
 * reflects that as-is.
 * ==========================================
 */
function CodingViewInner() {
    const workspace = useCodingStore(state => state.workspace);
    const [task, setTask] = useState("");
    const [historyOpen, setHistoryOpen] = useState(false);
    const [rightTab, setRightTab] = useState("agent");

    useEffect(() => {
        let cancelled = false;

        (async () => {
            useCodingStore.getState().setWorkspaceLoading(true);
            const workspaceResult = await CodingSocketService.inspectWorkspace();
            if (!cancelled) {
                useCodingStore.getState().setWorkspaceLoading(false);
                if (workspaceResult.success) {
                    useCodingStore.getState().setWorkspace(workspaceResult.workspace);
                    useCodingStore.getState().setWorkspace({
                        configured: workspaceResult.configured,
                        root: workspaceResult.root
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

    const rightTabItems = [
        {
            key: "agent",
            label: <span><RobotOutlined /> Agent</span>,
            children: <AgentPanel task={task} onTaskChange={setTask} />
        },
        {
            key: "terminal",
            label: <span><CodeSandboxOutlined /> Terminal</span>,
            children: <TerminalPanel />
        },
        {
            key: "git",
            label: <span><BranchesOutlined /> Git</span>,
            children: <GitPanel />
        }
    ];

    return (
        <div className={styles.root}>
            <WorkspaceBar task={task} onOpenHistory={() => setHistoryOpen(true)} />

            <div className={styles.body}>
                <div className={styles.explorerPane}>
                    <FileExplorer />
                </div>

                <div className={styles.editorPane}>
                    {workspace.configured ? (
                        <CodeEditor />
                    ) : (
                        <div className={styles.emptyState}>
                            <CodeOutlined style={{ fontSize: 32, opacity: 0.4 }} />
                            <p>Set a workspace folder above to start editing.</p>
                        </div>
                    )}
                </div>

                <div className={styles.sidePane}>
                    <Tabs
                        activeKey={rightTab}
                        onChange={setRightTab}
                        items={rightTabItems}
                        className={styles.sideTabs}
                    />
                </div>
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
