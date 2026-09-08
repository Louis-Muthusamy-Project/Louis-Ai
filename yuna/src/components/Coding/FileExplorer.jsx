import React, { useEffect, useState } from "react";
import { Tree, Spin, Empty, Dropdown, Modal, Input, App as AntApp } from "antd";
import {
    FolderOutlined, FolderOpenOutlined, FileOutlined, ReloadOutlined,
    LockOutlined, PlusOutlined, DeleteOutlined, EditOutlined
} from "@ant-design/icons";

import CodingSocketService from "../../services/codingSocketService";
import useCodingStore from "../../store/codingStore";

import styles from "./fileExplorer.module.css";

/**
 * A real file explorer: every directory is fetched from the backend on
 * expand (lazy - never dumps the whole workspace into the browser at
 * once, per the performance requirement), and every mutation (create,
 * rename, delete) goes through CodingWorkspaceCapability. Delete without
 * confirmed:true comes back CONFIRMATION_REQUIRED - handled here by simply
 * surfacing that as an error and telling the user to use the AI agent's
 * approval flow or confirm explicitly, rather than silently retrying with
 * confirmed:true (a human explicitly clicking Delete IS the confirmation,
 * so we do pass confirmed:true here - see handleDelete below - the
 * distinction from the agent's flow is that a human directly driving the
 * file explorer has already given informed, in-the-moment consent via the
 * confirmation modal; the backend's approval-pause machinery exists for
 * the *agent* acting autonomously, not for direct user actions).
 */
export default function FileExplorer() {
    const { message, modal } = AntApp.useApp();

    const workspace = useCodingStore(state => state.workspace);
    const tree = useCodingStore(state => state.tree);
    const expandedDirs = useCodingStore(state => state.expandedDirs);
    const activeTabPath = useCodingStore(state => state.activeTabPath);

    const [creating, setCreating] = useState(null); // { parentPath, type: 'file' } | null
    const [newName, setNewName] = useState("");
    const [renaming, setRenaming] = useState(null); // { path } | null
    const [renameValue, setRenameValue] = useState("");

    useEffect(() => {
        if (workspace.configured) {
            loadDir(".");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspace.configured, workspace.root]);

    async function loadDir(relPath) {
        useCodingStore.getState().setDirLoading(relPath, true);
        const result = await CodingSocketService.listDirectory(relPath);
        if (!result.success) {
            useCodingStore.getState().setDirError(relPath, result.message);
            return;
        }
        useCodingStore.getState().setDirEntries(relPath, result.entries);
    }

    function handleExpand(keys, { node }) {
        useCodingStore.getState().toggleExpanded(node.key);
        if (!tree[node.key]) {
            loadDir(node.key);
        }
    }

    async function handleOpenFile(path) {
        useCodingStore.getState().openTabLoading(path);
        const result = await CodingSocketService.readFile(path);
        if (!result.success) {
            useCodingStore.getState().setTabError(path, result.message);
            message.error(result.message || "Could not open file.");
            return;
        }
        useCodingStore.getState().setTabContent(path, result.content, result.hash);
    }

    function joinPath(dir, name) {
        return dir === "." ? name : `${dir}/${name}`;
    }

    function startCreate(parentPath) {
        setCreating({ parentPath });
        setNewName("");
    }

    async function confirmCreate() {
        if (!newName.trim() || !creating) return;
        const path = joinPath(creating.parentPath, newName.trim());
        const result = await CodingSocketService.createFile(path, "");
        setCreating(null);
        if (!result.success) {
            message.error(result.message || "Could not create file.");
            return;
        }
        loadDir(creating.parentPath);
        handleOpenFile(path);
    }

    function startRename(path) {
        setRenaming({ path });
        setRenameValue(path.split("/").pop());
    }

    async function confirmRename() {
        if (!renaming || !renameValue.trim()) return;
        const parent = renaming.path.includes("/") ? renaming.path.slice(0, renaming.path.lastIndexOf("/")) : ".";
        const to = joinPath(parent, renameValue.trim());
        const result = await CodingSocketService.renameFile(renaming.path, to);
        setRenaming(null);
        if (!result.success) {
            message.error(result.message || "Could not rename.");
            return;
        }
        loadDir(parent);
    }

    function handleDelete(path) {
        modal.confirm({
            title: "Delete file?",
            content: path,
            okText: "Delete",
            okButtonProps: { danger: true },
            onOk: async () => {
                // A human explicitly confirming in this dialog is the
                // informed consent the backend's confirmed:true flag
                // requires - this is not the agent bypassing its own
                // approval pause, it's the direct-user-action path.
                const result = await CodingSocketService.deleteFile(path, true);
                if (!result.success) {
                    message.error(result.message || "Could not delete.");
                    return;
                }
                const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".";
                loadDir(parent);
                useCodingStore.getState().closeTab(path);
            }
        });
    }

    if (!workspace.configured) {
        return (
            <div className={styles.emptyState}>
                <Empty description="Set a workspace to browse files" />
            </div>
        );
    }

    const treeData = buildTreeData(".", tree, expandedDirs, joinPath);

    return (
        <div className={styles.explorer}>
            <div className={styles.header}>
                <span>Explorer</span>
                <div className={styles.headerActions}>
                    <PlusOutlined onClick={() => startCreate(".")} title="New file" />
                    <ReloadOutlined onClick={() => loadDir(".")} title="Refresh" />
                </div>
            </div>

            {creating && (
                <div className={styles.inlineInput}>
                    <Input
                        size="small"
                        autoFocus
                        placeholder="filename.js"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onPressEnter={confirmCreate}
                        onBlur={() => setCreating(null)}
                    />
                </div>
            )}

            {renaming && (
                <Modal
                    open
                    title="Rename"
                    onOk={confirmRename}
                    onCancel={() => setRenaming(null)}
                >
                    <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} onPressEnter={confirmRename} autoFocus />
                </Modal>
            )}

            <Tree
                className={styles.tree}
                treeData={treeData}
                onExpand={handleExpand}
                expandedKeys={Object.keys(expandedDirs).filter(k => expandedDirs[k])}
                selectedKeys={activeTabPath ? [activeTabPath] : []}
                onSelect={(keys, { node }) => {
                    if (node.isLeaf) handleOpenFile(node.key);
                }}
                titleRender={(node) => (
                    <FileTreeItem
                        node={node}
                        onCreate={() => startCreate(node.key)}
                        onRename={() => startRename(node.key)}
                        onDelete={() => handleDelete(node.key)}
                    />
                )}
            />
        </div>
    );
}

function FileTreeItem({ node, onCreate, onRename, onDelete }) {
    const items = node.isLeaf
        ? [
            { key: "rename", label: "Rename", icon: <EditOutlined /> },
            { key: "delete", label: "Delete", icon: <DeleteOutlined />, danger: true }
        ]
        : [
            { key: "create", label: "New File", icon: <PlusOutlined /> },
            { key: "rename", label: "Rename", icon: <EditOutlined /> },
            { key: "delete", label: "Delete", icon: <DeleteOutlined />, danger: true }
        ];

    function onMenuClick({ key, domEvent }) {
        domEvent.stopPropagation();
        if (key === "create") onCreate();
        if (key === "rename") onRename();
        if (key === "delete") onDelete();
    }

    return (
        <Dropdown menu={{ items, onClick: onMenuClick }} trigger={["contextMenu"]}>
            <span className={styles.itemLabel}>
                {node.secret && <LockOutlined className={styles.secretIcon} title="Protected file" />}
                {node.title}
            </span>
        </Dropdown>
    );
}

function buildTreeData(relPath, tree, expandedDirs, joinPath) {
    const dirState = tree[relPath];
    if (!dirState) {
        return [];
    }
    if (dirState.loading) {
        return [{ key: `${relPath}::loading`, title: <Spin size="small" />, isLeaf: true, selectable: false }];
    }
    if (dirState.error) {
        return [{ key: `${relPath}::error`, title: <span className={styles.errorLabel}>{dirState.error}</span>, isLeaf: true, selectable: false }];
    }

    return dirState.entries
        .slice() // don't mutate store state
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1))
        .map(entry => {
            const key = joinPath(relPath, entry.name);
            if (entry.type === "directory") {
                return {
                    key,
                    title: entry.name,
                    icon: expandedDirs[key] ? <FolderOpenOutlined /> : <FolderOutlined />,
                    isLeaf: false,
                    secret: entry.secret,
                    children: expandedDirs[key] ? buildTreeData(key, tree, expandedDirs, joinPath) : []
                };
            }
            return {
                key,
                title: entry.name,
                icon: <FileOutlined />,
                isLeaf: true,
                secret: entry.secret
            };
        });
}
