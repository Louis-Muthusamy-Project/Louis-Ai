import React, { useState } from "react";
import { Modal, Button, Tag, Typography, App as AntApp } from "antd";
import { WarningOutlined } from "@ant-design/icons";

import CodingSocketService from "../../services/codingSocketService";
import useCodingStore from "../../store/codingStore";

const { Text, Paragraph } = Typography;

/**
 * Shown whenever the backend emits coding:approval:required (relayed via
 * CodingProvider into codingStore.pendingApproval). Approve/Deny both
 * call CodingAgentRuntime.resume() through the backend - this component
 * makes no safety decision itself, it only presents what the backend
 * already decided needs a human. The approvalId travels with the
 * decision and is single-use server-side (replay/stale rejected there),
 * so even if this dialog were somehow triggered twice, the second
 * resume() call is a no-op error, not a second execution.
 */
export default function ApprovalDialog() {
    const { message } = AntApp.useApp();
    const pendingApproval = useCodingStore(state => state.pendingApproval);
    const [busy, setBusy] = useState(false);

    if (!pendingApproval) return null;

    async function respond(approved) {
        setBusy(true);
        CodingSocketService.resumeAgent({
            sessionId: pendingApproval.sessionId,
            approved,
            approvalId: pendingApproval.approvalId
        });
        // The actual outcome (execution result or cancellation) arrives
        // via the normal CODING_* activity stream, same as everything
        // else in this session - this dialog just needs to get out of
        // the way once the decision is sent.
        useCodingStore.getState().clearPendingApproval();
        setBusy(false);
        message.info(approved ? "Approved - resuming the agent." : "Denied - the agent was told no.");
    }

    const riskLevel = pendingApproval.reason === "SECRET_FILE_BLOCKED" ? "Sensitive" : "High";

    return (
        <Modal
            open
            closable={false}
            maskClosable={false}
            title={<span><WarningOutlined style={{ color: "#f59e0b", marginRight: 8 }} />Agent needs approval</span>}
            footer={[
                <Button key="deny" onClick={() => respond(false)} loading={busy}>Deny</Button>,
                <Button key="approve" type="primary" danger onClick={() => respond(true)} loading={busy}>Approve</Button>
            ]}
        >
            <Paragraph>
                <Text strong>Action:</Text> {describeTool(pendingApproval.tool)}
            </Paragraph>
            {(pendingApproval.args?.path || pendingApproval.args?.command) && (
                <Paragraph>
                    <Text strong>Target:</Text> <Text code>{pendingApproval.args.path || pendingApproval.args.command}</Text>
                </Paragraph>
            )}
            <Paragraph>
                <Text strong>Risk:</Text> <Tag color={riskLevel === "High" ? "red" : "orange"}>{riskLevel}</Tag>
            </Paragraph>
            <Paragraph>
                <Text strong>Reason:</Text> {pendingApproval.message}
            </Paragraph>
        </Modal>
    );
}

function describeTool(tool) {
    const labels = {
        file_delete: "Delete a file",
        terminal_run: "Run a destructive terminal command",
        file_read: "Read a file that looks like it may contain secrets",
        file_write: "Write to a file that looks like it may contain secrets"
    };
    return labels[tool] || String(tool || "").replace(/_/g, " ");
}
