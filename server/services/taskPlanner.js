/**
 * ==========================================
 * TaskPlanner - Sequencer for multi-step tasks
 * ==========================================
 */
class TaskPlanner {
    constructor(kernel) {
        this.kernel = kernel;
    }

    get providerManager() {
        return this.kernel.get("providerManager");
    }

    /**
     * Generates an execution plan based on detected intent.
     * @param {Object} context Context state
     * @param {Object} detectionResult { intent, confidence, parameters, riskLevel, requiresTool, requiresConfirmation }
     * @returns {Promise<Object>} Plan structure: { steps: [{ capability, args }] }
     */
    async plan(context, detectionResult) {
        const { intent, parameters, requiresTool } = detectionResult;
        
        // If it doesn't require a tool, no strict plan is needed, it's just a conversational response.
        if (!requiresTool || intent === "conversation" || intent === "question") {
            return { steps: [] };
        }

        // Fast-path simple systems
        if (intent === "system" && parameters.command === "time") {
            return {
                steps: [{ capability: "system.time", args: {} }]
            };
        }

        // For complex intents, ask LLM to map to specific capabilities
        const systemPrompt = `You are Yuna's Task Planner.
Map the user's intent to a sequence of capabilities. 

Available capabilities mapping:
- memory: memory.store, memory.retrieve, memory.delete
- browser: browser.navigate, browser.click, browser.type
- desktop: system.launchApp
- coding: coding.readFile, coding.applyPatch, coding.runTests
- voice: voice.speak

Intent: ${intent}
Parameters: ${JSON.stringify(parameters)}

Provide a JSON object matching this schema EXACTLY:
{
  "steps": [
    {
      "capability": "string (e.g. system.launchApp)",
      "args": object
    }
  ]
}

Response MUST be JSON only. No explanation. No markdown codeblocks.`;

        try {
            const contents = [
                {
                    role: "user",
                    parts: [{ text: systemPrompt }]
                }
            ];

            const reply = await this.providerManager.generate(contents);
            
            let jsonText = reply.trim();
            if (jsonText.startsWith("```json")) {
                jsonText = jsonText.replace(/^```json/, "").replace(/```$/, "").trim();
            } else if (jsonText.startsWith("```")) {
                jsonText = jsonText.replace(/^```/, "").replace(/```$/, "").trim();
            }

            const parsed = JSON.parse(jsonText);
            return { steps: parsed.steps || [] };
        } catch (err) {
            console.error("[TaskPlanner] Failed to generate plan via LLM:", err.message);
            return { steps: [] };
        }
    }
}

module.exports = TaskPlanner;
