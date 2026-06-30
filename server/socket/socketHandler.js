const { generateReply } = require("../services/geminiService");

const { getMemory, updateMemory, clearMemory } = require("../memory/memoryStore");
const { extractMemory } = require("../services/memoryService");

const {
    getPersonality,
    updatePersonality,
    clearPersonality,
} = require("../memory/personalityStore");
const {
    detectPersonalityChange,
} = require("../services/personalityService");

const { getEmotion, setEmotion, clearEmotion } = require("../memory/emotionStore");
const { detectEmotion } = require("../services/emotionService");

const {
    addEmotion,
    getHistory,
    clearHistory,
} = require("../memory/emotionHistoryStore");
const {
    analyzeEmotionPattern,
} = require("../services/emotionAnalyzer");

function normalizeMessagePayload(data) {
    const message = data?.message ?? data?.text;

    if (typeof message !== "string") {
        return null;
    }

    const trimmed = message.trim();
    return trimmed ? trimmed : null;
}

function applyMemory(socketId, memoryData) {
    if (!memoryData) return;

    const update = {
        fact: {
            type: memoryData.type,
            value: memoryData.value,
        },
    };

    if (memoryData.type === "name") update.name = memoryData.value;
    if (memoryData.type === "nickname") update.nickname = memoryData.value;
    if (memoryData.type === "language") update.language = memoryData.value;
    if (memoryData.type === "like") update.like = memoryData.value;

    updateMemory(socketId, update);
}

function emitTyping(socket, status) {
    socket.emit("yuna_typing", { status });
    socket.emit("yuna:typing", { status });
}

function emitReply(socket, payload) {
    socket.emit("yuna_reply", payload);
    socket.emit("yuna:message:reply", {
        id: `${Date.now()}-${socket.id}`,
        role: "assistant",
        text: payload.message,
        createdAt: new Date().toISOString(),
        emotion: payload.emotion,
        intensity: payload.intensity,
        voice: payload.voice,
    });
}

function emitError(socket, message) {
    socket.emit("yuna_error", {
        message,
        emotion: "neutral",
        intensity: 50,
    });
    socket.emit("yuna:message:error", {
        message,
        createdAt: new Date().toISOString(),
    });
}

function socketHandler(io) {
    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);
        socket.emit("yuna:connection:ready", { socketId: socket.id });

        const handleUserMessage = async (data) => {
            try {
                const userMessage = normalizeMessagePayload(data);

                if (!userMessage) {
                    socket.emit("yuna_error", {
                        message: "Please send a non-empty message.",
                    });
                    return;
                }

                console.log("User:", userMessage);

                emitTyping(socket, true);

                const memoryData = extractMemory(userMessage);
                applyMemory(socket.id, memoryData);
                const memory = getMemory(socket.id);

                const personalityChange = detectPersonalityChange(userMessage);
                if (personalityChange) {
                    updatePersonality(socket.id, personalityChange);
                }
                const personality = getPersonality(socket.id);

                const detectedEmotion = detectEmotion(userMessage);
                setEmotion(socket.id, detectedEmotion);
                const emotion = getEmotion(socket.id);

                addEmotion(socket.id, emotion);
                const history = getHistory(socket.id);
                const pattern = analyzeEmotionPattern(history);

                const reply = await generateReply(userMessage, {
                    memory,
                    personality,
                    emotion,
                    pattern,
                });

                emitTyping(socket, false);

                emitReply(socket, {
                    message: reply,
                    emotion: emotion.mood,
                    intensity: emotion.intensity,
                    confidence: emotion.confidence,
                    personality,
                    memory,
                    pattern,
                    voice: { enabled: true },
                });

            } catch (error) {
                console.error("Socket Error:", error);

                emitTyping(socket, false);
                emitError(socket, "Sorry... something went wrong. I couldn't reply properly.");
            }
        };

        socket.on("user_message", handleUserMessage);
        socket.on("yuna:message:send", handleUserMessage);

        socket.on("disconnect", () => {
            clearMemory(socket.id);
            clearPersonality(socket.id);
            clearEmotion(socket.id);
            clearHistory(socket.id);
            console.log("User disconnected:", socket.id);
        });
    });
}

module.exports = socketHandler;
