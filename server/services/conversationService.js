const { randomUUID } = require("crypto");

const MAX_HISTORY = 30;

const sessions = new Map();

function createSession(socketId) {
    if (sessions.has(socketId)) {
        return sessions.get(socketId);
    }

    const session = {
        id: randomUUID(),
        socketId,
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [],
    };

    sessions.set(socketId, session);

    return session;
}

function getSession(socketId) {
    return createSession(socketId);
}

function addUserMessage(socketId, text) {
    const session = createSession(socketId);

    session.messages.push({
        id: randomUUID(),
        role: "user",
        text,
        createdAt: new Date().toISOString(),
    });

    trim(session);
}

function addAssistantMessage(socketId, text) {
    const session = createSession(socketId);

    session.messages.push({
        id: randomUUID(),
        role: "model",
        text,
        createdAt: new Date().toISOString(),
    });

    trim(session);
}

function getHistory(socketId) {
    const session = createSession(socketId);

    return session.messages.map((message) => ({
        role: message.role,
        parts: [
            {
                text: message.text,
            },
        ],
    }));
}

function clearSession(socketId) {
    sessions.delete(socketId);
}

function trim(session) {
    session.updatedAt = new Date();

    if (session.messages.length > MAX_HISTORY) {
        session.messages.splice(
            0,
            session.messages.length - MAX_HISTORY
        );
    }
}

function sessionInfo(socketId) {
    const session = createSession(socketId);

    return {
        id: session.id,
        totalMessages: session.messages.length,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
    };
}

module.exports = {
    createSession,
    getSession,
    getHistory,
    addUserMessage,
    addAssistantMessage,
    clearSession,
    sessionInfo,
};