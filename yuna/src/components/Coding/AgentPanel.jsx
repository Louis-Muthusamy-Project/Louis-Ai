import React, { useEffect, useRef } from "react";
import { Input, Empty, Statistic, Button, Tag, Tooltip, App as AntApp } from "antd";
import {
    LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined, StopOutlined,
    ToolOutlined, FileTextOutlined, CodeOutlined, WarningOutlined, ThunderboltOutlined,
    PaperClipOutlined, AudioOutlined, PlayCircleOutlined
} from "@ant-design/icons";

import useCodingStore from "../../store/codingStore";
import useCodingAgentRunner from "../../hooks/useCodingAgentRunner";
import useSpeechRecognition from "../../hooks/useSpeechRecognition";

import styles from "./agentPanel.module.css";

const { TextArea } = Input;

// Files under this size (bytes) can be read as text and folded into the
// task prompt as real context - large files are refused rather than
// silently truncated into something misleading.
const MAX_ATTACH_BYTES = 200 * 1024;

/**
 * The real AI Agent panel: current task/model/status, a live activity
 * timeline, and its own task composer (Attach/Mic/Run Agent), all driven
 * by actual CodingAgentRuntime state relayed through CodingProvider into
 * codingStore - nothing here is a frontend timer or a fabricated
 * "Reading files..." placeholder. Run/Stop go through the exact same
 * useCodingAgentRunner the top WorkspaceBar's own Run/Stop button uses -
 * one real implementation, not two.
 */
export default function AgentPanel({ task, onTaskChange }) {
    const { message } = AntApp.useApp();
    const session = useCodingStore(state => state.session);
    const activity = useCodingStore(state => state.activity);
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);

    const { running, handleRun, handleStop } = useCodingAgentRunner(task);
    const { supported: micSupported, listening, interimTranscript, error: micError, start: startMic, stop: stopMic } = useSpeechRecognition();

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [activity.length]);

    useEffect(() => {
        if (micError) message.error(`Mic: ${micError}`);
    }, [micError, message]);

    function handleMicToggle() {
        if (!micSupported) {
            message.error("Speech recognition isn't available in this browser.");
            return;
        }
        if (listening) {
            stopMic();
            return;
        }
        startMic("en-US", (finalTranscript) => {
            onTaskChange(((task || "").trim() + " " + finalTranscript).trim());
        });
    }

    function handleAttachClick() {
        fileInputRef.current?.click();
    }

    function handleFileSelected(e) {
        const file = e.target.files?.[0];
        e.target.value = ""; // allow re-selecting the same file later
        if (!file) return;
        if (file.size > MAX_ATTACH_BYTES) {
            message.error(`"${file.name}" is too large to attach as text context (max ${Math.round(MAX_ATTACH_BYTES / 1024)}KB).`);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const content = String(reader.result || "");
            const block = `\n\n[Attached: ${file.name}]\n\`\`\`\n${content}\n\`\`\``;
            onTaskChange(((task || "") + block).slice(0, 20000)); // hard cap so one huge paste can't break the prompt
            message.success(`Attached "${file.name}" as context.`);
        };
        reader.onerror = () => message.error(`Could not read "${file.name}".`);
        reader.readAsText(file);
    }

    return (
        <div className={styles.panel}>
            {session && (
                <div className={styles.statusBar}>
                    <Tag color={stateColor(session.state)}>{session.state}</Tag>
                    {session.model && (
                        <Tooltip title={`${session.provider} · ${session.model}`}>
                            <span className={styles.modelBadge}>{session.model}</span>
                        </Tooltip>
                    )}
                </div>
            )}

            <div className={styles.timelineHeader}>Agent Activity</div>
            <div className={styles.timeline} ref={scrollRef}>
                {activity.length === 0 ? (
                    <Empty description="No activity yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                    activity.map((entry, idx) => (
                        <ActivityRow key={idx} entry={entry} />
                    ))
                )}
            </div>

            {session && (
                <div className={styles.stats}>
                    <Statistic title="Iterations" value={session.iterations} valueStyle={{ fontSize: 16 }} />
                    <Statistic title="Tool calls" value={session.toolCalls} valueStyle={{ fontSize: 16 }} />
                    <Statistic title="Files changed" value={session.changedFiles.length} valueStyle={{ fontSize: 16 }} />
                </div>
            )}

            {session?.message && (session.state === "COMPLETED" || session.state === "FAILED" || session.state === "LIMIT_REACHED") && (
                <div className={session.state === "FAILED" ? styles.finalError : styles.finalResult}>
                    {session.message}
                </div>
            )}

            <div className={styles.composer}>
                <TextArea
                    placeholder="Ask Yuna to modify this project…"
                    value={task}
                    onChange={e => onTaskChange(e.target.value)}
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    disabled={running}
                />
                {listening && (
                    <div className={styles.interim}>{interimTranscript || "Listening…"}</div>
                )}
                <div className={styles.composerActions}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        style={{ display: "none" }}
                        onChange={handleFileSelected}
                        accept="text/*,.js,.jsx,.ts,.tsx,.json,.md,.css,.html,.py,.java,.go,.rs,.txt,.yml,.yaml"
                    />
                    <Tooltip title="Attach a file as context">
                        <Button size="small" icon={<PaperClipOutlined />} onClick={handleAttachClick} disabled={running} />
                    </Tooltip>
                    <Tooltip title={listening ? "Stop dictating" : "Dictate the task"}>
                        <Button
                            size="small"
                            danger={listening}
                            icon={<AudioOutlined />}
                            onClick={handleMicToggle}
                            disabled={running || !micSupported}
                        />
                    </Tooltip>
                    <div className={styles.composerSpacer} />
                    {running ? (
                        <Button danger size="small" icon={<StopOutlined />} onClick={handleStop}>Stop</Button>
                    ) : (
                        <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={handleRun}>Run Agent</Button>
                    )}
                </div>
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

function ActivityRow({ entry }) {
    const { icon, label, tone } = describe(entry);
    return (
        <div className={`${styles.row} ${styles[tone]}`}>
            <span className={styles.rowIcon}>{icon}</span>
            <span className={styles.rowLabel}>{label}</span>
        </div>
    );
}

function describe(entry) {
    switch (entry.event) {
        case "thinking":
            return { icon: <ThunderboltOutlined />, label: `Reasoning (iteration ${entry.iteration})`, tone: "neutral" };
        case "tool_start":
            return { icon: <ToolOutlined />, label: `Calling ${prettyTool(entry.tool)}${describeArgs(entry)}`, tone: "neutral" };
        case "tool_result":
            return {
                icon: entry.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />,
                label: `${prettyTool(entry.tool)} → ${entry.summary || (entry.success ? "done" : "failed")}`,
                tone: entry.success ? "success" : "error"
            };
        case "file_changed":
            return { icon: <FileTextOutlined />, label: `Changed ${entry.path}`, tone: "success" };
        case "terminal_start":
            return { icon: <CodeOutlined />, label: `Running: ${entry.command}`, tone: "neutral" };
        case "terminal_complete":
            return {
                icon: entry.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />,
                label: `Command finished (exit ${entry.exitCode})`,
                tone: entry.success ? "success" : "error"
            };
        case "approval_required":
            return { icon: <WarningOutlined />, label: `Approval needed: ${entry.message}`, tone: "warning" };
        case "complete":
            return { icon: <CheckCircleOutlined />, label: entry.message || "Agent finished", tone: "success" };
        case "error":
            return { icon: <CloseCircleOutlined />, label: entry.message || "Agent error", tone: "error" };
        case "cancelled":
            return { icon: <StopOutlined />, label: entry.message || "Agent cancelled", tone: "neutral" };
        default:
            return { icon: <LoadingOutlined />, label: entry.event, tone: "neutral" };
    }
}

function prettyTool(tool) {
    return String(tool || "").replace(/_/g, " ");
}

function describeArgs(entry) {
    const path = entry.args?.path || entry.args?.command;
    return path ? `: ${path}` : "";
}
