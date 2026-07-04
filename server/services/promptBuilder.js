const { YUNA_SYSTEM_PROMPT } = require("../prompts/yunaPrompt");

class PromptBuilder {

    build(options = {}) {

        const {

            history = [],

            memory = [],

            emotion = "happy",

            currentTime = new Date(),

            userMessage = ""

        } = options;

        let prompt = "";

        // -----------------------------
        // Base Personality
        // -----------------------------

        prompt += YUNA_SYSTEM_PROMPT + "\n\n";

        // -----------------------------
        // Time
        // -----------------------------

        prompt += `Current Time: ${currentTime.toLocaleString()}\n\n`;

        // -----------------------------
        // Emotion
        // -----------------------------

        prompt += `Current Emotion: ${emotion}\n\n`;

        // -----------------------------
        // Memory
        // -----------------------------

        if (memory.length) {

            prompt += "Important User Memory:\n";

            memory.forEach(item => {

                prompt += `- ${item}\n`;

            });

            prompt += "\n";

        }

        // -----------------------------
        // Conversation
        // -----------------------------

        if (history.length) {

            prompt += "Conversation History:\n";

            history.forEach(msg => {

                const role =
                    msg.role === "model"
                        ? "Yuna"
                        : "User";

                const text = msg.parts?.[0]?.text || "";

                prompt += `${role}: ${text}\n`;

            });

            prompt += "\n";

        }

        // -----------------------------
        // User Message
        // -----------------------------

        prompt += `User: ${userMessage}\n\n`;

        prompt += "Reply as Yuna.";

        return prompt;

    }

}

module.exports = new PromptBuilder();