const mongoose = require("mongoose");

/**
 * A coding-agent session record. `history` is the opaque, provider-native
 * conversation array (Gemini Content[] / OpenAI Responses input[] /
 * Claude Messages[]) - every adapter's shape is plain JSON (no functions,
 * no class instances), so it round-trips through Mongoose's Mixed type
 * safely and is exactly what's needed to genuinely resume a paused run,
 * including after a server restart.
 *
 * Intentionally NEVER stored here: raw API keys (never part of this
 * shape to begin with - keys live only in process.env, read by the
 * provider constructors), secret file contents (tool results for
 * SECRET_FILE_BLOCKED activity only ever contain the block message, never
 * file content - see CodingWorkspaceService), or terminal environment
 * variables (CodingTerminalService only ever returns stdout/stderr/exitCode,
 * never the child process's env).
 */
const codingSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    providerName: { type: String, required: true },
    task: { type: String, required: true },
    state: { type: String, required: true },
    history: { type: mongoose.Schema.Types.Mixed, default: [] },
    finalText: { type: String, default: "" },
    message: { type: String, default: "" },
    iterations: { type: Number, default: 0 },
    toolCalls: { type: Number, default: 0 },
    changedFiles: { type: [String], default: [] },
    // Bounded on write (see codingSessionRecord.js) - not an unbounded log.
    activity: { type: [mongoose.Schema.Types.Mixed], default: [] },
    pendingApproval: { type: mongoose.Schema.Types.Mixed, default: null },
    startedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.CodingSession || mongoose.model("CodingSession", codingSessionSchema);
