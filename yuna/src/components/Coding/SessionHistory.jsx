import React, { useEffect, useState } from "react";
import { Drawer, List, Tag, Button, Empty, App as AntApp } from "antd";

import CodingSocketService from "../../services/codingSocketService";
import useCodingStore from "../../store/codingStore";

/**
 * Lists this user's own coding sessions - the backend's getOwned()/
 * listForUser() already scope this to the authenticated caller (see
 * CodingSessionService), so there is no client-side filtering needed or
 * possible here; a cross-user session simply never appears in the list
 * returned by the backend in the first place.
 *
 * [Resume] is only shown when the backend record's own state is
 * WAITING_FOR_APPROVAL - never rendered just because the UI "wants" a
 * resume button (per the explicit requirement not to fake this).
 */
export default function SessionHistory({ open, onClose }) {
    const { message } = AntApp.useApp();
    const sessionHistory = useCodingStore(state => state.sessionHistory);
    const sessionHistoryLoading = useCodingStore(state => state.sessionHistoryLoading);
    const [detail, setDetail] = useState(null);

    useEffect(() => {
        if (open) loadHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    async function loadHistory() {
        useCodingStore.getState().setSessionHistoryLoading(true);
        const result = await CodingSocketService.listSessions(50);
        if (!result.success) {
            useCodingStore.getState().setSessionHistoryLoading(false);
            message.error(result.message || "Could not load session history.");
            return;
        }
        useCodingStore.getState().setSessionHistory(result.sessions);
    }

    async function openDetail(sessionId) {
        const result = await CodingSocketService.getSession(sessionId);
        if (!result.success) {
            message.error(result.message || "Could not load this session.");
            return;
        }
        setDetail(result.session);
    }

    function resumeSession(session) {
        if (!session.pendingApproval) return;
        CodingSocketService.resumeAgent({
            sessionId: session.sessionId,
            approved: true,
            approvalId: session.pendingApproval.approvalId
        });
        onClose();
        message.info("Resuming session…");
    }

    return (
        <Drawer title="Coding Sessions" open={open} onClose={() => { onClose(); setDetail(null); }} width={420}>
            {detail ? (
                <SessionDetail session={detail} onBack={() => setDetail(null)} onResume={resumeSession} />
            ) : (
                <List
                    loading={sessionHistoryLoading}
                    dataSource={sessionHistory}
                    locale={{ emptyText: <Empty description="No sessions yet" /> }}
                    renderItem={(session) => (
                        <List.Item onClick={() => openDetail(session.sessionId)} style={{ cursor: "pointer" }}>
                            <List.Item.Meta
                                title={<span>{session.task?.slice(0, 60) || "(no task text)"}</span>}
                                description={
                                    <>
                                        <Tag>{session.providerName}</Tag>
                                        <Tag color={stateColor(session.state)}>{session.state}</Tag>
                                        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                                            {session.startedAt ? new Date(session.startedAt).toLocaleString() : ""}
                                        </div>
                                    </>
                                }
                            />
                        </List.Item>
                    )}
                />
            )}
        </Drawer>
    );
}

function SessionDetail({ session, onBack, onResume }) {
    return (
        <div>
            <Button size="small" onClick={onBack} style={{ marginBottom: 12 }}>← Back</Button>
            <p><strong>Task:</strong> {session.task}</p>
            <p><strong>Provider:</strong> {session.providerName}</p>
            <p><strong>Status:</strong> <Tag color={stateColor(session.state)}>{session.state}</Tag></p>
            <p><strong>Iterations:</strong> {session.iterations} · <strong>Tool calls:</strong> {session.toolCalls}</p>
            {session.changedFiles?.length > 0 && (
                <div>
                    <strong>Changed files:</strong>
                    <ul>
                        {session.changedFiles.map(f => <li key={f}>{f}</li>)}
                    </ul>
                </div>
            )}
            {session.finalText && <p><strong>Result:</strong> {session.finalText}</p>}
            {session.state === "WAITING_FOR_APPROVAL" && session.pendingApproval ? (
                <Button type="primary" onClick={() => onResume(session)}>Resume (approve pending action)</Button>
            ) : (
                session.state === "WAITING_FOR_APPROVAL" && (
                    <p style={{ opacity: 0.6 }}>This session was waiting for approval, but the pending action is no longer resumable.</p>
                )
            )}
        </div>
    );
}

function stateColor(state) {
    switch (state) {
        case "RUNNING": return "processing";
        case "WAITING_FOR_APPROVAL": return "warning";
        case "COMPLETED": return "success";
        case "FAILED": return "error";
        default: return "default";
    }
}
