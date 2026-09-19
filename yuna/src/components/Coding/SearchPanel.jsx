import React, { useState } from "react";
import { Input, Empty, Spin, App as AntApp } from "antd";
import { FileTextOutlined } from "@ant-design/icons";

import CodingSocketService from "../../services/codingSocketService";
import useCodingStore from "../../store/codingStore";
import { openCodingFile } from "./openFile";

import styles from "./searchPanel.module.css";

/**
 * Real workspace search - calls the same backend workspace.search action
 * CodingWorkspaceService always had (filename + file-content matches,
 * secrets excluded server-side). No client-side result fabrication: an
 * empty/failed search shows an empty state, never placeholder rows.
 *
 * Clicking a result opens the file (via the same openCodingFile() helper
 * FileExplorer uses) and, for a content match, asks CodeEditor to reveal
 * the matching line once the file finishes loading (see codingStore's
 * pendingReveal / CodeEditor's reveal effect).
 */
export default function SearchPanel() {
    const { message } = AntApp.useApp();
    const workspace = useCodingStore(state => state.workspace);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    async function runSearch() {
        const q = query.trim();
        if (!q) return;
        if (!workspace.configured) {
            message.warning("Set a workspace first.");
            return;
        }
        setLoading(true);
        setSearched(true);
        const result = await CodingSocketService.searchWorkspace(q, true);
        setLoading(false);
        if (!result.success) {
            setResults([]);
            message.error(result.message || "Search failed.");
            return;
        }
        setResults(result.results || []);
    }

    async function handleOpenResult(result) {
        await openCodingFile(result.path, { error: message.error }, result.line || null);
    }

    return (
        <div className={styles.panel}>
            <Input.Search
                placeholder={workspace.configured ? "Search files and file contents…" : "Set a workspace first"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onSearch={runSearch}
                disabled={!workspace.configured}
                loading={loading}
                allowClear
                className={styles.input}
            />

            <div className={styles.results}>
                {loading ? (
                    <div className={styles.loading}><Spin size="small" /></div>
                ) : !searched ? (
                    <Empty description="Search across your workspace" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : results.length === 0 ? (
                    <Empty description="No matches" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                    results.map((r, idx) => (
                        <button
                            key={`${r.path}:${r.line || 0}:${idx}`}
                            type="button"
                            className={styles.result}
                            onClick={() => handleOpenResult(r)}
                        >
                            <div className={styles.resultHeader}>
                                <FileTextOutlined className={styles.fileIcon} />
                                <span className={styles.resultPath}>{r.path}</span>
                                {r.line != null && <span className={styles.resultLine}>:{r.line}</span>}
                            </div>
                            {r.matchType === "content" && r.lineText && (
                                <div className={styles.resultLineText}>{r.lineText}</div>
                            )}
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
