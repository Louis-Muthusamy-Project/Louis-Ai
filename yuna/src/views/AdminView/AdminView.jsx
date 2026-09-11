import React, { useEffect, useState } from "react";
import { Table, Switch, Button, Popconfirm, Tag, App as AntApp, Typography } from "antd";
import { DeleteOutlined, ReloadOutlined, CrownOutlined } from "@ant-design/icons";

import adminService from "../../services/adminService";
import useAuthStore from "../../store/authStore";

import styles from "./adminView.module.css";

const { Title, Text } = Typography;

/**
 * ==========================================
 * AdminView
 * ------------------------------------------
 * Everything here is real: the user list, the module switches, and
 * delete all call the live /api/admin/* endpoints (see
 * server/controllers/admin.controller.js) - nothing is mocked/demo
 * data. Sensitive fields (password hash, tokens, provider keys) are
 * never present in what the backend returns here in the first place,
 * so there's nothing to accidentally render.
 *
 * A toggle flips optimistically then reconciles with the server's
 * response (or reverts on error) so the UI never claims a change
 * "took" when the backend actually rejected it.
 * ==========================================
 */
export default function AdminView() {
    const { message } = AntApp.useApp();
    const currentUser = useAuthStore(state => state.user);

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyIds, setBusyIds] = useState(() => new Set());

    useEffect(() => {
        loadUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function loadUsers() {
        setLoading(true);
        try {
            const result = await adminService.listUsers();
            setUsers(result.users || []);
        } catch (error) {
            message.error(error.message || "Failed to load users.");
        } finally {
            setLoading(false);
        }
    }

    function setBusy(userId, value) {
        setBusyIds(prev => {
            const next = new Set(prev);
            if (value) next.add(userId); else next.delete(userId);
            return next;
        });
    }

    async function handleToggle(user, featureKey, checked) {
        setBusy(user.id, true);
        const previous = user.features[featureKey];
        setUsers(prev => prev.map(u => u.id === user.id
            ? { ...u, features: { ...u.features, [featureKey]: checked } }
            : u));

        try {
            const result = await adminService.updateUserModules(user.id, { [featureKey]: checked });
            setUsers(prev => prev.map(u => u.id === user.id ? result.user : u));
        } catch (error) {
            message.error(error.message || "Failed to update module.");
            setUsers(prev => prev.map(u => u.id === user.id
                ? { ...u, features: { ...u.features, [featureKey]: previous } }
                : u));
        } finally {
            setBusy(user.id, false);
        }
    }

    async function handleDelete(user) {
        setBusy(user.id, true);
        try {
            await adminService.deleteUser(user.id);
            setUsers(prev => prev.filter(u => u.id !== user.id));
            message.success(`${user.name || user.email} was deleted.`);
        } catch (error) {
            message.error(error.message || "Failed to delete user.");
        } finally {
            setBusy(user.id, false);
        }
    }

    const columns = [
        {
            title: "Name",
            dataIndex: "name",
            key: "name",
            render: (name, record) => (
                <span>
                    {name}
                    {record.role === "super_admin" && <Tag color="gold" style={{ marginLeft: 8 }}><CrownOutlined /> Super Admin</Tag>}
                </span>
            )
        },
        { title: "Email", dataIndex: "email", key: "email" },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (status) => <Tag color={status === "disabled" ? "red" : "green"}>{status || "active"}</Tag>
        },
        {
            title: "Chat",
            key: "chat",
            render: (_, record) => (
                <Switch
                    checked={Boolean(record.features?.chat)}
                    disabled={record.role === "super_admin" || busyIds.has(record.id)}
                    onChange={(checked) => handleToggle(record, "chat", checked)}
                />
            )
        },
        {
            title: "Character",
            key: "character",
            render: (_, record) => (
                <Switch
                    checked={Boolean(record.features?.character)}
                    disabled={record.role === "super_admin" || busyIds.has(record.id)}
                    onChange={(checked) => handleToggle(record, "character", checked)}
                />
            )
        },
        {
            title: "Coding",
            key: "coding",
            render: (_, record) => (
                <Switch
                    checked={Boolean(record.features?.coding)}
                    disabled={record.role === "super_admin" || busyIds.has(record.id)}
                    onChange={(checked) => handleToggle(record, "coding", checked)}
                />
            )
        },
        {
            title: "Created",
            dataIndex: "createdAt",
            key: "createdAt",
            render: (value) => value ? new Date(value).toLocaleDateString() : "—"
        },
        {
            title: "Last Login",
            dataIndex: "lastLoginAt",
            key: "lastLoginAt",
            render: (value) => value ? new Date(value).toLocaleString() : "Never"
        },
        {
            title: "Actions",
            key: "actions",
            render: (_, record) => {
                const isSelf = currentUser && String(currentUser.id) === String(record.id);
                return (
                    <Popconfirm
                        title="Delete this account?"
                        description="This permanently removes the account and its data. This cannot be undone."
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleDelete(record)}
                        disabled={isSelf || busyIds.has(record.id)}
                    >
                        <Button
                            danger
                            type="text"
                            icon={<DeleteOutlined />}
                            disabled={isSelf || busyIds.has(record.id)}
                            title={isSelf ? "You cannot delete your own account here." : "Delete user"}
                        />
                    </Popconfirm>
                );
            }
        }
    ];

    return (
        <div className={styles.root}>
            <div className={styles.header}>
                <div>
                    <Title level={3} style={{ margin: 0 }}><CrownOutlined /> Super Admin</Title>
                    <Text type="secondary">Manage accounts and per-module access.</Text>
                </div>
                <Button icon={<ReloadOutlined />} onClick={loadUsers} loading={loading}>Refresh</Button>
            </div>

            <Table
                className={styles.table}
                rowKey="id"
                columns={columns}
                dataSource={users}
                loading={loading}
                pagination={{ pageSize: 20 }}
            />
        </div>
    );
}
