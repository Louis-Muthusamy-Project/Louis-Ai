

const SocketEvents = Object.freeze({

    /**
     * Connection
     */

    CONNECTION_READY: "yuna:connection:ready",

    CONNECTION_ERROR: "yuna:connection:error",

    DISCONNECTED: "yuna:disconnect",

    /**
     * Chat
     */

    MESSAGE_SEND: "yuna:message:send",

    MESSAGE_REPLY: "yuna:message:reply",

    MESSAGE_ERROR: "yuna:message:error",

    /**
     * Streaming
     */

    STREAM_START: "yuna:stream:start",

    STREAM_CHUNK: "yuna:stream:chunk",

    STREAM_END: "yuna:stream:end",

    STREAM_CANCEL: "yuna:stream:cancel",

    /**
     * Typing
     */

    TYPING_START: "yuna:typing:start",

    TYPING_STOP: "yuna:typing:stop",

    THINKING_START: "yuna:thinking:start",

    THINKING_END: "yuna:thinking:end",

    /**
     * Voice
     */

    VOICE_START: "yuna:voice:start",

    VOICE_CHUNK: "yuna:voice:chunk",

    VOICE_END: "yuna:voice:end",

    VOICE_ERROR: "yuna:voice:error",

    IMAGE_START: "yuna:image:start",

    IMAGE_RESULT: "yuna:image:result",

    IMAGE_ERROR: "yuna:image:error",

    /**
     * Coding Agent
     */

    CODING_SESSION_START: "yuna:coding:session:start",

    CODING_AGENT_THINKING: "yuna:coding:agent:thinking",

    CODING_TOOL_START: "yuna:coding:tool:start",

    CODING_TOOL_RESULT: "yuna:coding:tool:result",

    CODING_FILE_CHANGED: "yuna:coding:file:changed",

    CODING_TERMINAL_START: "yuna:coding:terminal:start",

    CODING_TERMINAL_OUTPUT: "yuna:coding:terminal:output",

    CODING_TERMINAL_COMPLETE: "yuna:coding:terminal:complete",

    CODING_APPROVAL_REQUIRED: "yuna:coding:approval:required",

    CODING_AGENT_COMPLETE: "yuna:coding:agent:complete",

    CODING_AGENT_ERROR: "yuna:coding:agent:error",

    CODING_AGENT_CANCELLED: "yuna:coding:agent:cancelled",

    /**
     * Character
     */

    CHARACTER_STATE: "yuna:character:state",

    CHARACTER_EMOTION: "yuna:character:emotion",

    EMOTION_UPDATE: "yuna:emotion:update",

    /**
     * Memory
     */

    MEMORY_SAVE: "yuna:memory:save",

    MEMORY_CLEAR: "yuna:memory:clear",

    /**
     * System
     */

    SYSTEM_STATUS: "yuna:system:status",

    SYSTEM_ERROR: "yuna:system:error",

    SYSTEM_HEALTH: "yuna:system:health"

});

module.exports = SocketEvents;