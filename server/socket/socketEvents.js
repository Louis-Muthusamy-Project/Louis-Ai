/**
 * ==========================================
 * Yuna Socket Events
 * ------------------------------------------
 * Single source of truth for every
 * Socket.IO event used by frontend/backend.
 * ==========================================
 */

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

    /**
     * Character
     */

    CHARACTER_STATE: "yuna:character:state",

    CHARACTER_EMOTION: "yuna:character:emotion",

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