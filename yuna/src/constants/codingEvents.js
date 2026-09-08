/**
 * Coding panel socket event names - mirrors server/socket/socketEvents.js's
 * CODING_* constants exactly. Client -> server event names (emitted, no
 * matching Events.* constant needed server-side since those are just
 * socket.on() string literals there too) are included here as well so
 * every raw string lives in exactly one place on this side.
 */

// Server -> client (activity stream, routed to the owning user only)
export const CODING_SESSION_START = "yuna:coding:session:start";
export const CODING_AGENT_THINKING = "yuna:coding:agent:thinking";
export const CODING_TOOL_START = "yuna:coding:tool:start";
export const CODING_TOOL_RESULT = "yuna:coding:tool:result";
export const CODING_FILE_CHANGED = "yuna:coding:file:changed";
export const CODING_TERMINAL_START = "yuna:coding:terminal:start";
export const CODING_TERMINAL_OUTPUT = "yuna:coding:terminal:output";
export const CODING_TERMINAL_COMPLETE = "yuna:coding:terminal:complete";
export const CODING_APPROVAL_REQUIRED = "yuna:coding:approval:required";
export const CODING_AGENT_COMPLETE = "yuna:coding:agent:complete";
export const CODING_AGENT_ERROR = "yuna:coding:agent:error";
export const CODING_AGENT_CANCELLED = "yuna:coding:agent:cancelled";

// Client -> server (fire-and-forget; results arrive via the events above)
export const CODING_AGENT_RUN = "CODING_AGENT_RUN";
export const CODING_AGENT_CANCEL = "CODING_AGENT_CANCEL";
export const CODING_AGENT_RESUME = "CODING_AGENT_RESUME";
export const CODING_PROVIDERS_LIST = "CODING_PROVIDERS_LIST";
export const CODING_PROVIDERS_RESULT = "CODING_PROVIDERS_RESULT";

// Client -> server (ack-based request/response; see socketService.emitWithAck)
export const CODING_CAPABILITY_ACTION = "CODING_CAPABILITY_ACTION";

// Client -> server terminal.run only: emitted back to the SAME socket the
// instant a manually-triggered command actually starts, carrying the
// runId needed to cancel it - the ack response for CODING_CAPABILITY_ACTION
// only arrives once the command finishes, too late for Cancel to work.
export const CODING_TERMINAL_RUN_STARTED = "CODING_TERMINAL_RUN_STARTED";
