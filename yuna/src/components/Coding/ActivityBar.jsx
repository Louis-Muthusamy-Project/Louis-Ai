import React from "react";
import { Tooltip, Badge } from "antd";
import {
    FolderOutlined, SearchOutlined, BranchesOutlined,
    RobotOutlined, CodeSandboxOutlined, HistoryOutlined
} from "@ant-design/icons";

import styles from "./activityBar.module.css";

/**
 * The IDE's left icon rail. Purely a dumb rail: it reports which icon was
 * clicked, and CodingView (which owns activeSidePanel/agentPanelOpen/
 * bottomPanelOpen) decides what "clicking Explorer" or "clicking Agent"
 * actually does - see CodingView's handleActivityClick for the real
 * open/close/toggle rules (only one side panel at a time; Agent/Terminal
 * are independent toggles - see that function's own comment for why).
 *
 * `active` marks which icons are currently "on" so the rail reflects the
 * real panel state rather than tracking its own.
 */
const ITEMS = [
    { key: "explorer", label: "Explorer", icon: <FolderOutlined />, shortcut: "Ctrl+Shift+E" },
    { key: "search", label: "Search", icon: <SearchOutlined />, shortcut: "" },
    { key: "git", label: "Source Control", icon: <BranchesOutlined />, shortcut: "Ctrl+Shift+G" },
    { key: "agent", label: "Agent", icon: <RobotOutlined />, shortcut: "Ctrl+Shift+A" },
    { key: "terminal", label: "Terminal", icon: <CodeSandboxOutlined />, shortcut: "Ctrl+Shift+~" },
    { key: "history", label: "History", icon: <HistoryOutlined />, shortcut: "Ctrl+Shift+H" }
];

export default function ActivityBar({ active, onSelect, agentHasActivity }) {
    return (
        <div className={styles.rail}>
            {ITEMS.map((item) => {
                const isActive = active.has(item.key);
                const button = (
                    <button
                        key={item.key}
                        type="button"
                        className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
                        onClick={() => onSelect(item.key)}
                        aria-label={item.label}
                        aria-pressed={isActive}
                    >
                        {item.key === "agent" && agentHasActivity && !isActive ? (
                            <Badge dot offset={[-2, 2]}>{item.icon}</Badge>
                        ) : item.icon}
                    </button>
                );
                return (
                    <Tooltip key={item.key} title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label} placement="right">
                        {button}
                    </Tooltip>
                );
            })}
        </div>
    );
}
