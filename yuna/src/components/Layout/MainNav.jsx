import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Segmented, Button } from "antd";
import { MessageOutlined, SmileOutlined, CodeOutlined, SettingOutlined } from "@ant-design/icons";

import useLayoutStore from "../../store/layoutStore";

import styles from "./mainNav.module.css";

const TABS = [
    { value: "/chat", label: "Chat", icon: <MessageOutlined /> },
    { value: "/character", label: "Character", icon: <SmileOutlined /> },
    { value: "/coding", label: "Coding", icon: <CodeOutlined /> }
];

/**
 * Exactly three primary tabs - Chat, Character, Coding. No "Developer",
 * "Terminal", or "IDE" tab; Terminal/Git/File Explorer live as sub-panels
 * inside the Coding view (see CodingView.jsx), not as separate top-level
 * navigation.
 *
 * Also carries a Settings shortcut - ChatHeader (Chat-tab-only) already
 * has one, but Character/Coding have no other way to reach the existing
 * Settings drawer, and Coding must not grow its own duplicate API-key UI
 * (keys stay backend-only, managed in exactly one place).
 */
export default function MainNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const toggleDrawer = useLayoutStore(state => state.toggleDrawer);

    const current = TABS.find(t => location.pathname.startsWith(t.value))?.value || "/chat";

    return (
        <div className={styles.wrap}>
            <Segmented
                value={current}
                onChange={(value) => navigate(value)}
                options={TABS.map(t => ({ value: t.value, label: <span className={styles.tabLabel}>{t.icon} {t.label}</span> }))}
            />
            <Button
                className={styles.settingsButton}
                type="text"
                icon={<SettingOutlined />}
                onClick={() => toggleDrawer("settings")}
            />
        </div>
    );
}
