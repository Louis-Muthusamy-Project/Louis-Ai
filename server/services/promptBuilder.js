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
            memory = [], // semantic memories list
            emotion = "happy",
            emotionState = null,  // EmotionState value object summary
            currentTime = new Date(),
            userMessage = "",
            toolResults = [],
            intent = "CHAT",
            userProfile = {},
            relationship = {},
            timeline = [],
            goals = [],
            projects = [],
            personalityDirectives = ""
        } = options;

        let prompt = "";

        prompt += YUNA_SYSTEM_PROMPT + "\n\n";
        prompt += `Current Time: ${currentTime.toLocaleString()}\n`;
        prompt += `Current Emotion: ${emotion}\n`;
        prompt += `Detected Intent: ${intent}\n`;
        if (relationship && relationship.level) {
            prompt += `Relationship Level: ${relationship.level}/10 (Points: ${relationship.points})\n`;
        }
        prompt += "\n";

        // Yuna's current emotional state (cognitive axes)
        if (emotionState) {
            prompt += "=== Yuna's Current Emotional State ===\n";
            prompt += `${emotionState._promptSummary || [
                `Primary Emotion: ${emotionState.primary || emotion}`,
                `Mood: ${emotionState.mood ?? 0} (${emotionState.mood > 0.3 ? 'positive' : emotionState.mood < -0.3 ? 'negative' : 'balanced'})`,
                `Energy: ${emotionState.energy ?? 0.7}`,
                `Curiosity: ${emotionState.curiosity ?? 0.5}`,
                `Stress: ${emotionState.stress ?? 0.1}`,
                `Trust: ${emotionState.trust ?? 0.5}`,
                `Confidence: ${emotionState.confidence ?? 0.6}`,
                `Focus: ${emotionState.focus ?? 0.5}`
            ].join('\n')}\n`;
            prompt += "\n";
        }

        if (userProfile && (userProfile.name || userProfile.job || (userProfile.hobbies && userProfile.hobbies.length))) {
            prompt += "=== User Profile ===\n";
            if (userProfile.name) prompt += `- Name: ${userProfile.name}\n`;
            if (userProfile.job) prompt += `- Job: ${userProfile.job}\n`;
            if (userProfile.birthday) prompt += `- Birthday: ${userProfile.birthday}\n`;
            if (userProfile.hobbies && userProfile.hobbies.length) {
                prompt += `- Hobbies: ${userProfile.hobbies.join(", ")}\n`;
            }
            prompt += "\n";
        }

        if (memory.length) {
            prompt += "=== Retrieved Long-term Memories ===\n";
            memory.forEach(item => {
                prompt += `- ${item}\n`;
            });
            prompt += "\n";
        }

        if (goals && goals.length) {
            prompt += "=== User Goals ===\n";
            goals.forEach(g => {
                prompt += `- ${g}\n`;
            });
            prompt += "\n";
        }

        if (projects && projects.length) {
            prompt += "=== Active Projects ===\n";
            projects.forEach(p => {
                prompt += `- ${p}\n`;
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
        if (personalityDirectives) {
            prompt += `${personalityDirectives}\n`;
        }
        prompt += "1. Incorporate User Profile details, Goals, Projects, and Long-term Memories naturally in character.\n";
        prompt += "2. Reference the Tool Execution Results naturally if relevant to the User's query.\n";
        prompt += "3. Align voice tone and dialogue complexity to matches the Relationship Level.\n\n";
        prompt += "Reply as Yuna:";

        return prompt;
    }
}

const wrapper = {
    build: (opt) => Kernel.get("promptBuilder").build(opt)
};

module.exports = Object.assign(wrapper, { PromptBuilder });