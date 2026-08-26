import React from "react";
import { Avatar, Badge, Button, Tag, Tooltip, Typography } from "antd";
import { SettingOutlined } from "@ant-design/icons";

import useChatStore from "../../store/chatStore";
import useLayoutStore from "../../store/layoutStore";

import styles from "./chatHeader.module.css";

const AVATAR_URL =
    "https://res.cloudinary.com/dp4omlmzn/image/upload/v1783188927/Screenshot_2026-07-04_234010-removebg-preview_jnpupf.png";

export default function ChatHeader() {

    const connected = useChatStore(
        state => state.connected
    );

    const thinking = useChatStore(
        state => state.thinking
    );

    const toggleDrawer = useLayoutStore(
        state => state.toggleDrawer
    );

    return (

        <header className={styles.header}>

            <div className={styles.left}>

                <Badge
                    dot
                    color={connected ? "#10b981" : "#dc2626"}
                    offset={[-4, 36]}
                >
                    <Avatar
                        size={42}
                        src={AVATAR_URL}
                        alt="Yuna"
                    />
                </Badge>

                <div>
                    <Typography.Title
                        level={5}
                        style={{ margin: 0, color: "white" }}
                    >
                        Yuna
                    </Typography.Title>

                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {connected ? "Connected" : "Disconnected"}
                    </Typography.Text>
                </div>

            </div>

            <div className={styles.center}>
                <Tag
                    color={thinking ? "purple" : "default"}
                    bordered={false}
                >
                    {thinking ? "🧠 Thinking..." : "🎤 Ready"}
                </Tag>
            </div>

            <Tooltip title="Settings">
                <Button
                    className={styles.settingsButton}
                    type="text"
                    shape="circle"
                    size="large"
                    icon={<SettingOutlined />}
                    aria-label="Open settings"
                    onClick={() => toggleDrawer("settings")}
                />
            </Tooltip>

        </header>

    );

}