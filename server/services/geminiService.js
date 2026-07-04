const { GoogleGenAI } = require("@google/genai");

const { YUNA_SYSTEM_PROMPT } = require("../prompts/yunaPrompt");

const {
    getHistory,
    addUserMessage,
    addAssistantMessage,
} = require("./conversationService");

let ai = null;

function initializeGemini() {
    if (ai) {
        return ai;
    }

    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY not found.");
    }

    ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
    });

    console.log("✅ Gemini initialized.");

    return ai;
}

async function generateReply(socketId, userMessage) {
    const client = initializeGemini();

    addUserMessage(socketId, userMessage);

    const history = getHistory(socketId);

    const contents = [
        {
            role: "user",
            parts: [
                {
                    text: YUNA_SYSTEM_PROMPT,
                },
            ],
        },
        ...history,
    ];

    try {
        const response = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
        });

        const reply = response.text
            ? response.text.trim()
            : "Hmm... I don't know what to say.";

        addAssistantMessage(socketId, reply);

        return reply;
    } catch (error) {
        console.error("Gemini Error");
        console.error(error);

        throw error;
    }
}

module.exports = {
    generateReply,
    initializeGemini,
};