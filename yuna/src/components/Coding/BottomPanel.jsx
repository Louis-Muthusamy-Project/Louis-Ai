import React from "react";
import { Tabs, Empty } from "antd";
import { CloseOutlined } from "@ant-design/icons";

import TerminalPanel from "./TerminalPanel";

import styles from "./bottomPanel.module.css";

/**
 * The IDE's bottom panel. Only "Terminal" has a real backend behind it
 * (CodingWorkspaceCapability's terminal.run/cancel, see TerminalPanel.jsx
 * itself). Problems/Output/Debug Console/Ports are real, empty, honest
 * placeholders: there is no lint/build-diagnostics collector, no
 * structured log stream, no debug adapter, and no port-forwarding service
 * anywhere in this backend yet, so these tabs say exactly that rather
 * than showing invented rows. Wiring any of them up for real is a
 * separate, larger backend feature - not something to fake from the UI
 * side.
 */
const TABS = [
    { key: "terminal", label: "Terminal" },
    { key: "problems", label: "Problems" },
    { key: "output", label: "Output" },
    { key: "debug", label: "Debug Console" },
    { key: "ports", label: "Ports" }
];

export default function BottomPanel({ activeTab, onTabChange, onClose }) {
    const items = TABS.map((tab) => ({
        key: tab.key,
        label: tab.label,
        children: tab.key === "terminal" ? (
            <TerminalPanel />
        ) : (
            <div className={styles.notAvailable}>
                <Empty
                    description={NOT_AVAILABLE_COPY[tab.key]}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
            </div>
        )
    }));

    return (
        <div className={styles.panel}>
            <Tabs
                size="small"
                activeKey={activeTab}
                onChange={onTabChange}
                items={items}
                className={styles.tabs}
                tabBarExtraContent={
                    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close panel">
                        <CloseOutlined />
                    </button>
                }
            />
        </div>
    );
}

const NOT_AVAILABLE_COPY = {
    problems: "No lint/build diagnostics source is wired up yet.",
    output: "No structured output/log stream is wired up yet.",
    debug: "No debug adapter is wired up yet.",
    ports: "No port-forwarding is available in this workspace yet."
};
