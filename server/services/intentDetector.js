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
        // Basic fallback for simple exact matches to save tokens, although LLM is primary.
        if (normalized === "time") {
            return {
                intent: "system",
                confidence: 1.0,
                parameters: { command: "time" },
                riskLevel: "low",
                requiresTool: true,
                requiresConfirmation: false
            };
        }

        // 2. LLM-based classification
        try {
            const systemPrompt = `You are Yuna's Intent Classifier.
Analyze the user message and classify the intent strictly into one of the following categories:
- conversation
- question
- memory (e.g. "remember that I like X")
- reminder
- browser (e.g. "search the web", "open youtube")
- desktop (e.g. "open vscode", "launch notepad")
- coding
- vision
- image (e.g. "generate a picture of X", "draw me an anime girl under cherry blossoms")
- voice
- system (e.g. "what time is it")

Provide a JSON object matching this schema EXACTLY:
{
  "intent": "string (one of the above)",
  "confidence": number (0.0 to 1.0),
  "parameters": object (any extracted entities/args),
  "riskLevel": "low" | "medium" | "high" (high for dangerous commands like formatting drives, reading secrets, or irreversible actions),
  "requiresTool": boolean,
  "requiresConfirmation": boolean (true if riskLevel is high)
}

Response MUST be JSON only. No explanation. No markdown codeblocks.`;

            const contents = [
                {
                    role: "user",
                    parts: [
                        { text: `${systemPrompt}\n\nUser Message: "${text}"` }
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
            
            // Validate the result
            const validIntents = [
                "conversation", "question", "memory", "reminder", 
                "browser", "desktop", "coding", "vision", "image", "voice", "system"
            ];
            
            return {
                intent: validIntents.includes(parsed.intent) ? parsed.intent : "conversation",
                confidence: typeof parsed.confidence === "number" ? parsed.confidence : 1.0,
                parameters: parsed.parameters || {},
                riskLevel: ["low", "medium", "high"].includes(parsed.riskLevel) ? parsed.riskLevel : "low",
                requiresTool: !!parsed.requiresTool,
                requiresConfirmation: !!parsed.requiresConfirmation
            };
        } catch (error) {
            console.warn("[IntentDetector] LLM classification failed, falling back to conversation:", error.message);
            return { 
                intent: "conversation", 
                confidence: 0, 
                parameters: {}, 
                riskLevel: "low", 
                requiresTool: false, 
                requiresConfirmation: false 
            };
        }
    }
}

module.exports = IntentDetector;
