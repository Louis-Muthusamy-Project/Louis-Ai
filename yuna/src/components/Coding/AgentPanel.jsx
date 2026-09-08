import React, { useEffect, useRef } from "react";
import { Input, Empty, Statistic } from "antd";
import {
    LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined, StopOutlined,
    ToolOutlined, FileTextOutlined, CodeOutlined, WarningOutlined, ThunderboltOutlined
} from "@ant-design/icons";

import useCodingStore from "../../store/codingStore";

import styles from "./agentPanel.module.css";

const { TextArea } = Input;

/**
 * Task input + live activity timeline. Every entry rendered here comes
 * from a real CODING_* event relayed through CodingProvider into
 * codingStore's `activity` array - nothing here is a frontend timer or
 * a fabricated "Reading files..." placeholder.
 */
export default function AgentPanel({ task, onTaskChange }) {
    const session = useCodingStore(state => state.session);
    const activity = useCodingStore(state => state.activity);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [activity.length]);

    const running = session && (session.state === "RUNNING" || session.state === "WAITING_FOR_APPROVAL");

    return (
        <div className={styles.panel}>
            <div className={styles.taskArea}>
                <TextArea
                    placeholder="Describe a coding task for the agent, e.g. 'Fix the failing test in add.test.js'"
                    value={task}
                    onChange={e => onTaskChange(e.target.value)}
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    disabled={running}
                />
            </div>

            {session && (
                <div className={styles.stats}>
                    <Statistic title="Iterations" value={session.iterations} valueStyle={{ fontSize: 16 }} />
                    <Statistic title="Tool calls" value={session.toolCalls} valueStyle={{ fontSize: 16 }} />
                    <Statistic title="Files changed" value={session.changedFiles.length} valueStyle={{ fontSize: 16 }} />
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

            {session?.message && (session.state === "COMPLETED" || session.state === "FAILED" || session.state === "LIMIT_REACHED") && (
                <div className={session.state === "FAILED" ? styles.finalError : styles.finalResult}>
                    {session.message}
                </div>
            )}
        </div>
    );
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
