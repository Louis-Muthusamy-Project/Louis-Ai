import React, { useState, useEffect } from "react";
import { Button, List, Input, Empty, Tabs, Tag, App as AntApp } from "antd";
import { ReloadOutlined, DiffOutlined } from "@ant-design/icons";

import CodingSocketService from "../../services/codingSocketService";
import useCodingStore from "../../store/codingStore";

import styles from "./gitPanel.module.css";

const { TextArea } = Input;

/**
 * Real git status/diff/log/stage/unstage/commit - every action calls
 * CodingGitService through the socket layer. Deliberately has NO
 * push/pull/reset/checkout controls - those aren't implemented on the
 * backend at all (see CodingGitService), so there's nothing here to wire
 * up even if a control existed.
 */
export default function GitPanel() {
    const { message } = AntApp.useApp();
    const workspace = useCodingStore(state => state.workspace);
    const gitStatus = useCodingStore(state => state.gitStatus);
    const gitDiff = useCodingStore(state => state.gitDiff);
    const gitLog = useCodingStore(state => state.gitLog);

    const [selectedFile, setSelectedFile] = useState(null);
    const [commitMessage, setCommitMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [notARepo, setNotARepo] = useState(false);

    useEffect(() => {
        if (workspace.configured) refreshStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspace.configured, workspace.root]);

    async function refreshStatus() {
        setLoading(true);
        const result = await CodingSocketService.gitStatus();
        setLoading(false);
        if (!result.success) {
            setNotARepo(result.code === "NOT_A_REPO");
            return;
        }
        setNotARepo(false);
        useCodingStore.getState().setGitStatus(result);
    }

    async function loadDiff(file, staged) {
        const result = await CodingSocketService.gitDiff({ file, staged });
        if (!result.success) {
            message.error(result.message || "Could not load diff.");
            return;
        }
        useCodingStore.getState().setGitDiff(result.diff);
        setSelectedFile(file);
    }

    async function loadLog() {
        const result = await CodingSocketService.gitLog({ limit: 20 });
        if (!result.success) {
            message.error(result.message || "Could not load log.");
            return;
        }
        useCodingStore.getState().setGitLog(result.commits);
    }

    async function toggleStage(file, isStaged) {
        const result = isStaged
            ? await CodingSocketService.gitUnstage([file])
            : await CodingSocketService.gitStage([file]);
        if (!result.success) {
            message.error(result.message || "Could not update staging.");
            return;
        }
        useCodingStore.getState().setGitStatus(result);
    }

    async function handleCommit() {
        if (!commitMessage.trim()) {
            message.warning("Write a commit message first.");
            return;
        }
        const result = await CodingSocketService.gitCommit(commitMessage.trim());
        if (!result.success) {
            message.error(result.message || "Commit failed.");
            return;
        }
        message.success("Committed.");
        setCommitMessage("");
        refreshStatus();
    }

    if (!workspace.configured) {
        return <div className={styles.empty}><Empty description="Set a workspace first" /></div>;
    }
    if (notARepo) {
        return <div className={styles.empty}><Empty description="This workspace is not a git repository" /></div>;
    }

    const files = gitStatus?.files || [];
    const stagedFiles = files.filter(f => f.status[0] && f.status[0] !== " " && f.status[0] !== "?");
    const unstagedFiles = files.filter(f => !stagedFiles.includes(f));

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <span>{gitStatus?.branch ? `Branch: ${gitStatus.branch}` : "Git"}</span>
                <ReloadOutlined onClick={refreshStatus} spin={loading} />
            </div>

            <Tabs
                size="small"
                defaultActiveKey="changes"
                onChange={(key) => { if (key === "log") loadLog(); }}
                items={[
                    {
                        key: "changes",
                        label: "Changes",
                        children: (
                            <div className={styles.changesTab}>
                                <FileGroup
                                    title="Staged"
                                    files={stagedFiles}
                                    onDiff={f => loadDiff(f.path, true)}
                                    onToggle={f => toggleStage(f.path, true)}
                                    toggleLabel="Unstage"
                                />
                                <FileGroup
                                    title="Changes"
                                    files={unstagedFiles}
                                    onDiff={f => loadDiff(f.path, false)}
                                    onToggle={f => toggleStage(f.path, false)}
                                    toggleLabel="Stage"
                                />

                                {selectedFile && (
                                    <div className={styles.diffView}>
                                        <div className={styles.diffHeader}><DiffOutlined /> {selectedFile}</div>
                                        <DiffContent diff={gitDiff} />
                                    </div>
                                )}

                                <div className={styles.commitArea}>
                                    <TextArea
                                        placeholder="Commit message"
                                        value={commitMessage}
                                        onChange={e => setCommitMessage(e.target.value)}
                                        autoSize={{ minRows: 2, maxRows: 4 }}
                                    />
                                    <Button type="primary" block disabled={stagedFiles.length === 0} onClick={handleCommit}>
                                        Commit {stagedFiles.length > 0 ? `(${stagedFiles.length} file${stagedFiles.length > 1 ? "s" : ""})` : ""}
                                    </Button>
                                </div>
                            </div>
                        )
                    },
                    {
                        key: "log",
                        label: "Log",
                        children: (
                            <List
                                size="small"
                                dataSource={gitLog || []}
                                locale={{ emptyText: "No commits yet" }}
                                renderItem={(commit) => (
                                    <List.Item>
                                        <div className={styles.logEntry}>
                                            <div className={styles.logSubject}>{commit.subject}</div>
                                            <div className={styles.logMeta}>{commit.author} · {new Date(commit.date).toLocaleString()}</div>
                                        </div>
                                    </List.Item>
                                )}
                            />
                        )
                    }
                ]}
            />
        </div>
    );
}

function FileGroup({ title, files, onDiff, onToggle, toggleLabel }) {
    if (files.length === 0) return null;
    return (
        <div className={styles.group}>
            <div className={styles.groupTitle}>{title} ({files.length})</div>
            <List
                size="small"
                dataSource={files}
                renderItem={(f) => (
                    <List.Item className={styles.fileRow}>
                        <span className={styles.fileStatus}><Tag>{f.status || "?"}</Tag></span>
                        <span className={styles.filePath} onClick={() => onDiff(f)}>{f.path}</span>
                        <Button size="small" onClick={() => onToggle(f)}>{toggleLabel}</Button>
                    </List.Item>
                )}
            />
        </div>
    );
}

function DiffContent({ diff }) {
    if (!diff) return null;
    return (
        <pre className={styles.diffPre}>
            {diff.split("\n").map((line, idx) => {
                let cls = styles.diffContext;
                if (line.startsWith("+") && !line.startsWith("+++")) cls = styles.diffAdd;
                else if (line.startsWith("-") && !line.startsWith("---")) cls = styles.diffRemove;
                return <div key={idx} className={cls}>{line}</div>;
            })}
        </pre>
    );
}
