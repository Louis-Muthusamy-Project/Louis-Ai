const Kernel = require("../core/Kernel");

/**
 * ==========================================
 * IntentDetector - Classification Service
 * ==========================================
 */
class IntentDetector {
    constructor(kernel) {
        this.kernel = kernel;
    }

    get providerManager() {
        return this.kernel.get("providerManager");
    }

    /**
     * Determines the intent of a user message.
     * @param {string} text Incoming user text
     * @returns {Promise<Object>} Object { intent, tool, args }
     */
    async detect(text) {
        if (!text || !text.trim()) {
            return { intent: "CHAT", tool: null, args: null };
        }

        const normalized = text.toLowerCase().trim();

        // 1. Fast Pattern Check (Regex)
        // Time queries
        if (
            normalized.includes("time is it") ||
            normalized.includes("current time") ||
            normalized.includes("what time") ||
            normalized.includes("what is the time") ||
            normalized === "time"
        ) {
            return { intent: "USE_TOOL", tool: "time", args: {} };
        }

        // Calculator queries (numbers and operators)
        const mathRegex = /^(?:calculate|what is|whats)?\s*([0-9+\-*/().\s]+)$/;
        const match = normalized.match(mathRegex);
        if (match && /[0-9]/.test(match[1]) && /[+\-*/]/.test(match[1])) {
            const expression = match[1].trim();
            return { intent: "USE_TOOL", tool: "calculator", args: { expression } };
        }

        // 2. LLM-based classification fallback
        try {
            const systemPrompt = `You are Yuna's Intent Classifier. Your job is to classify the user's message intent into one of:
- CHAT: Conversational talk.
- USE_TOOL: Requesting a math calculation, equation solver, or the current time.

Provide a JSON object matching this schema:
{
  "intent": "CHAT" | "USE_TOOL",
  "tool": "calculator" | "time" | null,
  "args": { "expression": string } | {} | null
}

Response MUST be JSON only. No explanation. No markdown codeblocks.`;

            const contents = [
                {
                    role: "user",
                    parts: [
                        {
                            text: `${systemPrompt}\n\nUser Message: "${text}"`
                        }
                    ]
                }
            ];

            const reply = await this.providerManager.generate(contents);
            
            // Clean JSON string
            let jsonText = reply.trim();
            if (jsonText.startsWith("```json")) {
                jsonText = jsonText.replace(/^```json/, "").replace(/```$/, "").trim();
            } else if (jsonText.startsWith("```")) {
                jsonText = jsonText.replace(/^```/, "").replace(/```$/, "").trim();
            }

            const parsed = JSON.parse(jsonText);
            return {
                intent: parsed.intent || "CHAT",
                tool: parsed.tool || null,
                args: parsed.args || null
            };
        } catch (error) {
            console.warn("[IntentDetector] LLM classification failed, falling back to CHAT:", error.message);
            return { intent: "CHAT", tool: null, args: null };
        }
    }
}

module.exports = IntentDetector;
