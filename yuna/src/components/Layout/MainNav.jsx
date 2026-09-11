import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Segmented, Button } from "antd";
import { MessageOutlined, SmileOutlined, CodeOutlined, SettingOutlined, CrownOutlined } from "@ant-design/icons";

import useLayoutStore from "../../store/layoutStore";
import useAuthStore from "../../store/authStore";

import styles from "./mainNav.module.css";

const ALL_TABS = [
    { value: "/chat", label: "Chat", icon: <MessageOutlined />, feature: "chat" },
    { value: "/character", label: "Character", icon: <SmileOutlined />, feature: "character" },
    { value: "/coding", label: "Coding", icon: <CodeOutlined />, feature: "coding" }
];

/**
 * Exactly three primary tabs - Chat, Character, Coding - PLUS a Super
 * Admin tab, but ONLY for the exact authenticated Super Admin account
 * (user.role === "super_admin", which only ever comes from the server -
 * see server/services/authService.js/config/roles.js). This is UX only:
 * hiding a tab here doesn't grant access to anything - every route and
 * every backend endpoint/socket event behind it re-checks the same
 * server-side role/feature flags independently (requireFeature/
 * requireSuperAdmin), so a user manually navigating to a hidden route
 * still can't use it.
 *
 * A disabled feature (Super Admin turned Chat/Character/Coding off for
 * this account) removes that tab from the list entirely rather than
 * showing it greyed out, so there's nothing to click that would just
 * bounce off a 403.
 */
export default function MainNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const toggleDrawer = useLayoutStore(state => state.toggleDrawer);
    const user = useAuthStore(state => state.user);

    const features = (user && user.features) || {};
    const isSuperAdmin = user && user.role === "super_admin";

    const tabs = ALL_TABS.filter(t => isSuperAdmin || features[t.feature] !== false);
    if (isSuperAdmin) {
        tabs.push({ value: "/admin", label: "Super Admin", icon: <CrownOutlined /> });
    }

    const current = tabs.find(t => location.pathname.startsWith(t.value))?.value || tabs[0]?.value || "/chat";

    return (
        <div className={styles.wrap}>
            <Segmented
                value={current}
                onChange={(value) => navigate(value)}
                options={tabs.map(t => ({ value: t.value, label: <span className={styles.tabLabel}>{t.icon} {t.label}</span> }))}
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
