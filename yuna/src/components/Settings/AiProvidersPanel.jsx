import { useEffect, useState } from "react";
import { App as AntApp, Button, Card, Input, Space, Switch, Tag, Typography } from "antd";
import { CheckCircleFilled, DeleteOutlined, KeyOutlined } from "@ant-design/icons";

import providerSettingsService from "../../services/providerSettingsService";

const { Text, Paragraph } = Typography;

const PROVIDER_LABELS = {
    gemini: "Gemini",
    openai: "OpenAI",
    claude: "Claude"
};

const CAPABILITY_LABELS = {
    chat: "Chat Model",
    prompt: "Prompt Model",
    image: "Image Model",
    embedding: "Embedding Model",
    coding: "Coding Model",
    vision: "Vision Model"
};

/**
 * ==========================================
 * AiProvidersPanel
 * ------------------------------------------
 * Settings -> AI Providers. This is the ONLY place a user's Gemini/OpenAI/
 * Claude API key is entered anywhere in the app - there is no .env option.
 * Talks to /api/settings/providers (see providerSettingsService.js /
 * server/routes/providerSettingsRoutes.js). Every response from that API
 * only ever contains hasKey/maskedKey/enabled/models - this component
 * never receives, stores, or displays a decrypted key. The key input is
 * cleared from local state immediately after a successful save, so
 * nothing plaintext lingers in memory once the server has it.
 * ==========================================
 */
export default function AiProvidersPanel() {
    const { message } = AntApp.useApp();
    const [providers, setProviders] = useState(null);
    const [loading, setLoading] = useState(true);
    const [keyDrafts, setKeyDrafts] = useState({});
    const [editingKeyFor, setEditingKeyFor] = useState(null);
    const [savingKeyFor, setSavingKeyFor] = useState(null);
    const [modelDrafts, setModelDrafts] = useState({});
    const [savingModelsFor, setSavingModelsFor] = useState(null);

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function refresh() {
        try {
            setLoading(true);
            const list = await providerSettingsService.listProviders();
            setProviders(list);
            const drafts = {};
            for (const p of list) {
                drafts[p.provider] = { ...p.models };
            }
            setModelDrafts(drafts);
        } catch (error) {
            console.error(error);
            message.error("Couldn't load AI provider settings.");
        } finally {
            setLoading(false);
        }
    }

    function updateOne(provider, patch) {
        setProviders((prev) => prev.map((p) => (p.provider === provider ? { ...p, ...patch } : p)));
    }

    async function handleSaveKey(provider) {
        const draft = (keyDrafts[provider] || "").trim();
        if (!draft) {
            message.error("Enter an API key first.");
            return;
        }
        try {
            setSavingKeyFor(provider);
            const updated = await providerSettingsService.setApiKey(provider, draft);
            updateOne(provider, updated);
            setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
            setEditingKeyFor(null);
            message.success(`${PROVIDER_LABELS[provider]} API key saved.`);
        } catch (error) {
            console.error(error);
            message.error(error?.response?.data?.message || "Couldn't save that API key.");
        } finally {
            setSavingKeyFor(null);
        }
    }

    async function handleRemoveKey(provider) {
        try {
            setSavingKeyFor(provider);
            const updated = await providerSettingsService.removeApiKey(provider);
            updateOne(provider, updated);
            message.success(`${PROVIDER_LABELS[provider]} API key removed.`);
        } catch (error) {
            console.error(error);
            message.error("Couldn't remove that API key.");
        } finally {
            setSavingKeyFor(null);
        }
    }

    async function handleToggleEnabled(provider, checked) {
        updateOne(provider, { enabled: checked });
        try {
            const updated = await providerSettingsService.setEnabled(provider, checked);
            updateOne(provider, updated);
        } catch (error) {
            console.error(error);
            updateOne(provider, { enabled: !checked });
            message.error("Couldn't update that setting.");
        }
    }

    async function handleSaveModels(provider) {
        try {
            setSavingModelsFor(provider);
            const updated = await providerSettingsService.setModels(provider, modelDrafts[provider] || {});
            updateOne(provider, updated);
            message.success(`${PROVIDER_LABELS[provider]} models updated.`);
        } catch (error) {
            console.error(error);
            message.error("Couldn't save those models.");
        } finally {
            setSavingModelsFor(null);
        }
    }

    if (loading) {
        return <Text type="secondary">Loading…</Text>;
    }

    if (!providers) {
        return <Text type="secondary">Couldn't load AI provider settings.</Text>;
    }

    return (
        <div>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Add your own API key for each provider you want to use. Keys are encrypted at rest and are
                never sent back to this screen in plain text - once saved, only a masked version is shown.
                One key per provider is reused across every model/capability below it.
            </Paragraph>

            <Space direction="vertical" style={{ width: "100%" }} size={16}>
                {providers.map((p) => (
                    <Card
                        key={p.provider}
                        size="small"
                        title={
                            <Space>
                                <Text strong>{PROVIDER_LABELS[p.provider] || p.provider}</Text>
                                {p.hasKey ? (
                                    <Tag color={p.enabled ? "success" : "default"} icon={p.enabled ? <CheckCircleFilled /> : undefined}>
                                        {p.enabled ? "Configured" : "Disabled"}
                                    </Tag>
                                ) : (
                                    <Tag>Not configured</Tag>
                                )}
                            </Space>
                        }
                        extra={
                            p.hasKey && (
                                <Switch
                                    checked={p.enabled}
                                    onChange={(checked) => handleToggleEnabled(p.provider, checked)}
                                    checkedChildren="On"
                                    unCheckedChildren="Off"
                                />
                            )
                        }
                    >
                        <div style={{ marginBottom: 16 }}>
                            <Text className="ai-providers-label" style={{ display: "block", marginBottom: 6 }}>
                                API Key
                            </Text>
                            {p.hasKey && editingKeyFor !== p.provider ? (
                                <Space wrap>
                                    <Input
                                        style={{ width: 220 }}
                                        value={p.maskedKey || "••••••••••••"}
                                        disabled
                                        prefix={<KeyOutlined />}
                                    />
                                    <Button onClick={() => setEditingKeyFor(p.provider)}>Change</Button>
                                    <Button
                                        danger
                                        icon={<DeleteOutlined />}
                                        loading={savingKeyFor === p.provider}
                                        onClick={() => handleRemoveKey(p.provider)}
                                    >
                                        Remove
                                    </Button>
                                </Space>
                            ) : (
                                <Space wrap>
                                    <Input.Password
                                        style={{ width: 260 }}
                                        placeholder={`Paste your ${PROVIDER_LABELS[p.provider]} API key`}
                                        value={keyDrafts[p.provider] || ""}
                                        onChange={(e) => setKeyDrafts((prev) => ({ ...prev, [p.provider]: e.target.value }))}
                                    />
                                    <Button
                                        type="primary"
                                        loading={savingKeyFor === p.provider}
                                        onClick={() => handleSaveKey(p.provider)}
                                    >
                                        Save
                                    </Button>
                                    {p.hasKey && (
                                        <Button onClick={() => setEditingKeyFor(null)}>Cancel</Button>
                                    )}
                                </Space>
                            )}
                        </div>

                        {p.hasKey && (p.capabilities || []).length > 0 && (
                            <div>
                                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                                    {p.capabilities.map((capability) => (
                                        <div key={capability} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <Text style={{ width: 150, flexShrink: 0 }}>
                                                {CAPABILITY_LABELS[capability] || capability}
                                            </Text>
                                            <Input
                                                style={{ maxWidth: 260 }}
                                                placeholder={p.models?.[capability] || "default"}
                                                value={modelDrafts[p.provider]?.[capability] || ""}
                                                onChange={(e) => setModelDrafts((prev) => ({
                                                    ...prev,
                                                    [p.provider]: { ...prev[p.provider], [capability]: e.target.value }
                                                }))}
                                            />
                                        </div>
                                    ))}
                                </Space>
                                <Button
                                    style={{ marginTop: 12 }}
                                    size="small"
                                    loading={savingModelsFor === p.provider}
                                    onClick={() => handleSaveModels(p.provider)}
                                >
                                    Save models
                                </Button>
                            </div>
                        )}
                    </Card>
                ))}
            </Space>
        </div>
    );
}
