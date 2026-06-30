const { generateReply } = require("../services/geminiService");
const { getEmotion, setEmotion } = require("../memory/emotionStore");
const { detectEmotion } = require("../services/emotionService");
const { addEmotion, getHistory } = require("../memory/emotionHistoryStore");
const { analyzeEmotionPattern } = require("../services/emotionAnalyzer");

function socketHandler(io) {
    io.on("connection", (socket) => {
        console.log("🟢 User connected:", socket.id);

        socket.on("user_message", async (data) => {
            try {
                const userMessage = data.message;
                if (!userMessage) return;

                // 🎭 STEP 1: Detect emotion
                const detected = detectEmotion(userMessage);

                // 🔄 STEP 2: Update emotion state
                setEmotion(socket.id, detected);

                const emotion = getEmotion(socket.id);

                // 💜 Typing start
                socket.emit("yuna_typing", { status: true });
                const reply = await generateReply(userMessage, {
                    emotion,
                    pattern, // 👈 NEW
                });

                // 🤖 STEP 3: Send to Gemini with emotion context
                const reply = await generateReply(userMessage, {
                    emotion,
                });

                // 💜 Typing stop
                socket.emit("yuna_typing", { status: false });

                // 📡 Send reply + emotion
                socket.emit("yuna_reply", {
                    message: reply,
                    emotion: emotion.mood,
                    intensity: emotion.intensity,
                });

            } catch (error) {
                console.error(error);

                socket.emit("yuna_typing", { status: false });

                socket.emit("yuna_reply", {
                    message: "Emotion system error 💔",
                    emotion: "neutral",
                });
            }
        });
    });
}

module.exports = socketHandler;