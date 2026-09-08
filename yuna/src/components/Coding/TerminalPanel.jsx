import React, { useState, useRef, useEffect } from "react";
import { Input, Button, Empty, App as AntApp } from "antd";
import { PlayCircleOutlined, StopOutlined } from "@ant-design/icons";

import CodingSocketService from "../../services/codingSocketService";
import SocketService from "../../services/socketService";
import useCodingStore from "../../store/codingStore";
import { CODING_TERMINAL_RUN_STARTED } from "../../constants/codingEvents";

import styles from "./terminalPanel.module.css";

/**
 * Manual terminal execution - shares the same terminalHistory in
 * codingStore that the agent's own terminal_run/test_run tool calls
 * populate (via CodingProvider), so a user watching this panel sees
 * both their own commands and the agent's, in the order they actually
 * ran. Commands go through CodingWorkspaceCapability's terminal.run
 * action - always workspace-scoped, never an arbitrary cwd from the
 * browser (cwd here, when set, is still resolved/validated server-side
 * the same way as every other coding tool call).
 */
export default function TerminalPanel() {
    const { message } = AntApp.useApp();
    const [command, setCommand] = useState("");
    const [running, setRunning] = useState(false);
    const [currentRunId, setCurrentRunId] = useState(null);

    const terminalHistory = useCodingStore(state => state.terminalHistory);
    const workspace = useCodingStore(state => state.workspace);
    const scrollRef = useRef(null);

    const lastEntry = terminalHistory[terminalHistory.length - 1];
    const lastStdout = lastEntry?.stdout;

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [terminalHistory.length, lastStdout]);

    useEffect(() => {
        const onRunStarted = (data) => setCurrentRunId(data.runId);
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

        setRunning(true);
        setCurrentRunId(null);
        const localId = `manual:${Date.now()}`;
        useCodingStore.getState().startTerminalEntry(localId, cmd);
        setCommand("");

        const result = await CodingSocketService.runCommand(cmd);
        setRunning(false);
        setCurrentRunId(null);

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
        setCurrentRunId(null);
    }

    return (
        <div className={styles.panel}>
            <div className={styles.output} ref={scrollRef}>
                {terminalHistory.length === 0 ? (
                    <Empty description="No commands run yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                    terminalHistory.map(entry => (
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
    );
}
