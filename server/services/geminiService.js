const ai = require("../config/gemini");
const yunaPrompt = require("../prompts/yunaPrompt");

async function generateReply(userMessage, context = {}) {
    const { emotion, pattern } = context;

    const prompt = `
You are Yuna AI Companion.

CURRENT EMOTION:
- Mood: ${emotion?.mood}
- Intensity: ${emotion?.intensity}

EMOTION HISTORY INSIGHT:
- Dominant mood: ${pattern?.dominant}
- Trend: ${pattern?.trend}

RULES:
- If trend = declining → be extra comforting
- If trend = improving → be cheerful
- If user is often sad → show care
- Adapt personality based on emotional history

USER MESSAGE:
${userMessage}
    `;

    const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
    });

    return result.response.text();
}

module.exports = {
    generateReply,
};