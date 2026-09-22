import React, { useState, useRef, useEffect } from "react";
import { Input, Button, Empty, Tooltip, App as AntApp } from "antd";
import { PlayCircleOutlined, StopOutlined, PlusOutlined, CloseOutlined, CodeOutlined } from "@ant-design/icons";

import CodingSocketService from "../../services/codingSocketService";
import SocketService from "../../services/socketService";
import useCodingStore from "../../store/codingStore";
import { CODING_TERMINAL_RUN_STARTED } from "../../constants/codingEvents";

import styles from "./terminalPanel.module.css";

/**
 * Real, multiple independent terminal instances (like the VS Code/
 * Antigravity terminal list) - the "Agent" tab is where the real
 * CodingAgentRuntime's own tool-call terminal activity always lands
 * (see codingStore.startTerminalEntry's default terminalId and
 * CodingProvider.jsx's onTerminalStart), so a user watching it sees the
 * agent's real commands as they actually run; any additional tabs the
 * user opens with "+" are independent manual shells. The backend already
 * supports running multiple commands concurrently per user (each gets
 * its own runId - see CodingTerminalService's `_running` map), so
 * multiple tabs can genuinely have commands in flight at once - this is
 * a real capability, not a UI illusion over a single shared process.
 *
 * All commands still go through CodingWorkspaceCapability's terminal.run
 * action - always workspace-scoped, never an arbitrary cwd from the
 * browser.
 */
export default function TerminalPanel() {
    const { message } = AntApp.useApp();
    const [command, setCommand] = useState("");
    const [runningMap, setRunningMap] = useState({});
    const [currentRunIdMap, setCurrentRunIdMap] = useState({});

    const terminals = useCodingStore(state => state.terminals);
    const activeTerminalId = useCodingStore(state => state.activeTerminalId);
    const terminalHistory = useCodingStore(state => state.terminalHistory);
    const workspace = useCodingStore(state => state.workspace);
    const scrollRef = useRef(null);

    const activeHistory = terminalHistory.filter(e => e.terminalId === activeTerminalId);
    const running = !!runningMap[activeTerminalId];
    const currentRunId = currentRunIdMap[activeTerminalId] || null;

    const lastEntry = activeHistory[activeHistory.length - 1];
    const lastStdout = lastEntry?.stdout;

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [activeHistory.length, lastStdout]);

    useEffect(() => {
        // The agent's own runs (see codingStore's "agent" tab default) have
        // no clientRunToken - anything without one is attributed to the
        // "agent" tab, matching where its terminal history entries land.
        // A MANUAL run's own token-scoped listener (registered in
        // handleRun below) is what correctly attributes a run to whichever
        // tab actually started it, even with several tabs running
        // commands concurrently.
        const onRunStarted = (data) => {
            if (!data.clientRunToken) {
                setCurrentRunIdMap(prev => ({ ...prev, agent: data.runId }));
            }
        };
        SocketService.on(CODING_TERMINAL_RUN_STARTED, onRunStarted);
        return () => SocketService.off(CODING_TERMINAL_RUN_STARTED, onRunStarted);
    }, []);

    async function handleRun() {
        const cmd = command.trim();
        if (!cmd || running) return;
        if (!workspace.configured) {
            message.warning("Set a workspace first.");
            return;
        }

        const terminalId = activeTerminalId;
        setRunningMap(prev => ({ ...prev, [terminalId]: true }));
        const localId = `manual:${Date.now()}`;
        useCodingStore.getState().startTerminalEntry(localId, cmd, terminalId);
        setCommand("");

        // Scoped to just this one call via clientRunToken (echoed back
        // verbatim by the server - see socketHandler.js's terminal.run
        // handler) so a runId from a DIFFERENT tab's concurrent manual run
        // never gets misattributed to this tab.
        const clientRunToken = localId;
        const onThisRunStarted = (data) => {
            if (data.clientRunToken === clientRunToken) {
                setCurrentRunIdMap(prev => ({ ...prev, [terminalId]: data.runId }));
            }
        };
        SocketService.on(CODING_TERMINAL_RUN_STARTED, onThisRunStarted);

        const result = await CodingSocketService.runCommand(cmd, { clientRunToken });
        SocketService.off(CODING_TERMINAL_RUN_STARTED, onThisRunStarted);
        setRunningMap(prev => ({ ...prev, [terminalId]: false }));
        setCurrentRunIdMap(prev => ({ ...prev, [terminalId]: null }));

        if (!result.success && result.code === "CONFIRMATION_REQUIRED") {
            useCodingStore.getState().completeTerminalEntry(localId, { exitCode: null, success: false, timedOut: false });
            message.warning("That command is destructive and was refused. Re-run with explicit confirmation if you really intend it.");
            return;
        }
        if (!result.success) {
            useCodingStore.getState().completeTerminalEntry(localId, { exitCode: result.exitCode ?? null, success: false, timedOut: false });
            message.error(result.message || "Command failed to run.");
            return;
        }

        useCodingStore.getState().appendTerminalOutput(localId, { stdout: result.stdout, stderr: result.stderr });
        useCodingStore.getState().completeTerminalEntry(localId, { exitCode: result.exitCode, success: result.success, timedOut: result.timedOut });
    }

    async function handleCancel() {
        if (!currentRunId) return;
        await CodingSocketService.cancelCommand(currentRunId);
        setCurrentRunIdMap(prev => ({ ...prev, [activeTerminalId]: null }));
    }

    return (
        <div className={styles.panel}>
            <div className={styles.body}>
                <div className={styles.main}>
                    <div className={styles.output} ref={scrollRef}>
                        {activeHistory.length === 0 ? (
                            <Empty description="No commands run yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        ) : (
                            activeHistory.map(entry => (
                                <div key={entry.id} className={styles.entry}>
                                    <div className={styles.commandLine}>$ {entry.command}</div>
                                    {entry.stdout && <pre className={styles.stdout}>{entry.stdout}</pre>}
                                    {entry.stderr && <pre className={styles.stderr}>{entry.stderr}</pre>}
                                    {entry.running ? (
                                        <div className={styles.running}>Running…</div>
                                    ) : (
                                        <div className={entry.success ? styles.exitOk : styles.exitFail}>
                                            {entry.timedOut ? "Timed out" : `Exit code ${entry.exitCode}`}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    <div className={styles.inputRow}>
                        <Input
                            placeholder={workspace.configured ? "Run a command in the workspace…" : "Set a workspace first"}
                            value={command}
                            onChange={e => setCommand(e.target.value)}
                            onPressEnter={handleRun}
                            disabled={!workspace.configured || running}
                        />
                        {running ? (
                            <Button icon={<StopOutlined />} onClick={handleCancel} disabled={!currentRunId}>Cancel</Button>
                        ) : (
                            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleRun} disabled={!workspace.configured}>Run</Button>
                        )}
                    </div>
                </div>

                <div className={styles.instanceList}>
                    <div className={styles.instanceListHeader}>
                        <Tooltip title="New terminal">
                            <button type="button" className={styles.addButton} onClick={() => useCodingStore.getState().addTerminal()} aria-label="New terminal">
                                <PlusOutlined />
                            </button>
                        </Tooltip>
                    </div>
                    {[...terminals].reverse().map(t => (
                        <div
                            key={t.id}
                            className={`${styles.instance} ${t.id === activeTerminalId ? styles.instanceActive : ""}`}
                            onClick={() => useCodingStore.getState().setActiveTerminal(t.id)}
                        >
                            {runningMap[t.id] && <span className={styles.instanceRunningDot} />}
                            <CodeOutlined className={styles.instanceIcon} />
                            <span className={styles.instanceLabel}>{t.label}</span>
                            {t.closable && (
                                <button
                                    type="button"
                                    className={styles.instanceClose}
                                    aria-label={`Close ${t.label}`}
                                    onClick={(e) => { e.stopPropagation(); useCodingStore.getState().closeTerminal(t.id); }}
                                >
                                    <CloseOutlined />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
