import { useState } from "react";
import { App as AntApp, Button, Input, Select, Slider, Switch, Tabs, Typography } from "antd";
import { SaveOutlined } from "@ant-design/icons";

import useSettings from "../../hooks/useSettings";
import useSettingsStore from "../../store/settingsStore";
import SystemInfo from "../../components/System/SystemInfo";

import styles from "./settingsView.module.css";

const { Text } = Typography;

export default function SettingsView() {

    const { save } = useSettings();
    const { message } = AntApp.useApp();

    const settings = useSettingsStore(
        state => state.settings
    );

    const updateSetting = useSettingsStore(
        state => state.updateSetting
    );

    const [saving, setSaving] = useState(false);

    async function handleSave() {

        try {
            setSaving(true);
            await save();
            message.success("Settings saved.");
        }
        catch (error) {
            console.error(error);
            message.error("Couldn't save settings. Please try again.");
        }
        finally {
            setSaving(false);
        }

    }

    const items = [
        {
            key: "ai",
            label: "AI",
            children: (
                <div className={styles.group}>
                    <div className={styles.field}>
                        <Text className={styles.label}>Provider</Text>
                        <Select
                            className={styles.control}
                            value={settings.provider}
                            onChange={(value) => updateSetting("provider", value)}
                            options={[{ value: "gemini", label: "Gemini" }]}
                        />
                    </div>

                    <div className={styles.field}>
                        <Text className={styles.label}>Model</Text>
                        <Input
                            className={styles.control}
                            value={settings.model}
                            onChange={(e) => updateSetting("model", e.target.value)}
                        />
                    </div>
                </div>
            )
        },
        {
            key: "voice",
            label: "Voice",
            children: (
                <div className={styles.group}>
                    <div className={styles.field}>
                        <Text className={styles.label}>Provider</Text>
                        <Select
                            className={styles.control}
                            value={settings.voice}
                            onChange={(value) => updateSetting("voice", value)}
                            options={[{ value: "edge", label: "Edge TTS" }]}
                        />
                    </div>

                    <div className={styles.field}>
                        <Text className={styles.label}>Voice</Text>
                        <Input
                            className={styles.control}
                            value={settings.voiceName}
                            onChange={(e) => updateSetting("voiceName", e.target.value)}
                        />
                    </div>
                </div>
            )
        },
        {
            key: "streaming",
            label: "Streaming",
            children: (
                <div className={styles.group}>
                    <div className={styles.field}>
                        <Text className={styles.label}>
                            Speed — {settings.streamSpeed} ms
                        </Text>
                        <Slider
                            className={styles.control}
                            min={10}
                            max={100}
                            value={settings.streamSpeed}
                            onChange={(value) => updateSetting("streamSpeed", value)}
                        />
                    </div>
                </div>
            )
        },
        {
            key: "features",
            label: "Features",
            children: (
                <div className={styles.group}>
                    <div className={styles.switchRow}>
                        <Text>Memory</Text>
                        <Switch
                            checked={settings.memory}
                            onChange={(checked) => updateSetting("memory", checked)}
                        />
                    </div>

                    <div className={styles.switchRow}>
                        <Text>Debug Mode</Text>
                        <Switch
                            checked={settings.debug}
                            onChange={(checked) => updateSetting("debug", checked)}
                        />
                    </div>
                </div>
            )
        },
        {
            key: "system",
            label: "System",
            children: (
                <div className={styles.group}>
                    <SystemInfo />
                </div>
            )
        }
    ];

    return (

        <div className={styles.container}>

            <Tabs
                items={items}
                className={styles.tabs}
            />

            <Button
                className={styles.saveButton}
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSave}
                block
            >
                {saving ? "Saving..." : "Save Settings"}
            </Button>

        </div>

    );

}