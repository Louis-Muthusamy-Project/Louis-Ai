import React, { useEffect, useState } from "react";
import { Switch, Typography, Descriptions } from "antd";

import ElectronService from "../../services/electronService";

const { Text, Paragraph } = Typography;

const STATUS_LABELS = {
    initializing: "Initializing…",
    listening: "Ready",
    error: "Error",
    stopped: "Off"
};

const PERMISSION_LABELS = {
    granted: "Granted",
    denied: "Denied",
    unknown: "Unknown"
};

/**
 * Live status shown here comes entirely from the hidden wake-listener
 * window's own reports (see electron/ipc/wake.js's wake:status:update
 * broadcast) - this panel never talks to the microphone itself, it just
 * displays what the real listener window is actually doing.
 */
export default function WakeSettingsPanel() {
    const [available, setAvailable] = useState(ElectronService.available);
    const [enabled, setEnabled] = useState(true);
    const [status, setStatus] = useState({ permission: "unknown", engineStatus: "initializing", microphoneAvailable: null });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ElectronService.available) {
            setAvailable(false);
            setLoading(false);
            return undefined;
        }

        ElectronService.getWakeSettings().then((result) => {
            if (result) {
                setEnabled(result.enabled !== false);
                setStatus({
                    permission: result.permission || "unknown",
                    engineStatus: result.engineStatus || "initializing",
                    microphoneAvailable: result.microphoneAvailable
                });
            }
            setLoading(false);
        });

        ElectronService.onWakeStatusUpdate((update) => {
            if (update) setStatus(update);
        });

        return undefined;
    }, []);

    async function toggle(checked) {
        setEnabled(checked);
        const result = await ElectronService.setWakeEnabled(checked);
        if (result) {
            setStatus({
                permission: result.permission || "unknown",
                engineStatus: result.engineStatus || "initializing",
                microphoneAvailable: result.microphoneAvailable
            });
        }
    }

    if (!available) {
        return (
            <Paragraph type="secondary">
                Wake word ("Hey Yuna" / "Thangapila") is a desktop-only feature and isn't available in a browser tab - it runs through Yuna's Electron app.
            </Paragraph>
        );
    }

    return (
        <div>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                When enabled, Yuna listens in the background for &ldquo;Hey Yuna&rdquo; or &ldquo;Thangapila&rdquo; - even while another
                app is focused or the main window is minimized - and opens a small floating popup to take your request.
                This uses your microphone continuously while on; audio is processed by the browser&rsquo;s speech recognizer and is never saved to disk.
            </Paragraph>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <Switch checked={enabled} loading={loading} onChange={toggle} />
                <Text>{enabled ? "Wake word is on" : "Wake word is off"}</Text>
            </div>

            <Descriptions
                column={1}
                size="small"
                items={[
                    { key: "primary", label: "Primary phrase", children: "Hey Yuna" },
                    { key: "custom", label: "Custom phrase", children: "Thangapila" },
                    {
                        key: "mic",
                        label: "Microphone",
                        children: status.microphoneAvailable === false ? "Not available" : status.microphoneAvailable === true ? "Connected" : "Unknown"
                    },
                    { key: "engine", label: "Wake engine", children: STATUS_LABELS[status.engineStatus] || status.engineStatus || "Unknown" },
                    { key: "permission", label: "Permission", children: PERMISSION_LABELS[status.permission] || "Unknown" }
                ]}
            />
        </div>
    );
}
