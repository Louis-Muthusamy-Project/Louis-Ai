const { YUNA_SYSTEM_PROMPT } = require("../prompts/yunaPrompt");
const Kernel = require("../core/Kernel");

/**
 * ==========================================
 * PromptBuilder - Refactored Service Class
 * ==========================================
 */
class PromptBuilder {
    constructor(kernel) {
        this.kernel = kernel;
    }

    build(options = {}) {
        const {
            history = [],
            memory = [],
            emotion = "happy",
            currentTime = new Date(),
            userMessage = "",
            toolResults = [],
            intent = "CHAT"
        } = options;

        let prompt = "";

        prompt += YUNA_SYSTEM_PROMPT + "\n\n";
        prompt += `Current Time: ${currentTime.toLocaleString()}\n`;
        prompt += `Current Emotion: ${emotion}\n`;
        prompt += `Detected Intent: ${intent}\n\n`;

        if (memory.length) {
            prompt += "=== Important User Memory ===\n";
            memory.forEach(item => {
                prompt += `- ${item}\n`;
            });
            prompt += "\n";
        }

        if (toolResults && toolResults.length) {
            prompt += "=== Tool Execution Results ===\n";
            toolResults.forEach(res => {
                if (res.success) {
                    prompt += `Tool [${res.tool}] executed successfully.\n- Arguments: ${JSON.stringify(res.args)}\n- Output: ${JSON.stringify(res.result)}\n`;
                } else {
                    prompt += `Tool [${res.tool}] failed execution.\n- Arguments: ${JSON.stringify(res.args)}\n- Error: ${res.error}\n`;
                }
            });
            prompt += "\n";
        }

        if (history.length) {
            prompt += "=== Conversation History ===\n";
            history.forEach(msg => {
                const role = msg.role === "assistant" || msg.role === "model" ? "Yuna" : "User";
                const text = msg.parts?.[0]?.text || msg.text || "";
                prompt += `${role}: ${text}\n`;
            });
            prompt += "\n";
        }

        prompt += `User: ${userMessage}\n\n`;
        prompt += "Response Guidelines:\n";
        prompt += "1. Incorporate the Tool Execution Results naturally if relevant to the User's query.\n";
        prompt += "2. Respond in character as Yuna AI Companion.\n\n";
        prompt += "Reply as Yuna:";

        return prompt;
    }
}

const wrapper = {
    build: (opt) => Kernel.get("promptBuilder").build(opt)
};

module.exports = Object.assign(wrapper, { PromptBuilder });