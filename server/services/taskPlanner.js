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

        if (intent === "system" && parameters.command === "time") {
            return { steps: [] };
        }

        const systemPrompt = `You are Yuna's Task Planner.
Map the user's intent to a sequence of capabilities.

You may ONLY use these exact capability id strings - nothing else exists:

- "browser": web automation. args: {"action": "navigate"|"readText"|"search"|"newTab"|"switchTab"|"closeTab"|"getHistory"|"addBookmark"|"getBookmarks", "params": {...}}
  Example: {"action":"navigate","params":{"url":"https://google.com"}}
  Example: {"action":"search","params":{"query":"weather today"}}
- "coding": shell commands and AI code assistance. args: {"action": "runCommand"|"reviewCode"|"generateDocumentation"|"analyzeError"|"reviewArchitecture", "params": {...}}
  Example: {"action":"runCommand","params":{"command":"ls"}}
- "schedule": timers and reminders. args: {"action": "setTimer"|"setReminder"|"setRecurring"|"listTasks"|"cancelTask", "params": {...}}
  Example: {"action":"setReminder","params":{"dateString":"2026-01-01T10:00:00.000Z","message":"Call mom"}}
  Example: {"action":"setTimer","params":{"durationInSeconds":300,"message":"Check the oven"}}
- "image": generates an image from a text prompt. args: {"action":"generate","params":{"prompt":"<image description>"}}
- "codingWorkspace": file/terminal/git tools scoped to the user's configured coding workspace (see Settings). args: {"action": "workspace.inspect"|"workspace.list"|"workspace.search"|"file.read"|"file.write"|"file.create"|"file.delete"|"file.rename"|"terminal.run"|"git.status"|"git.diff"|"git.log"|"git.stage"|"git.commit"|"git.branch", "params": {...}}
  Example: {"action":"file.read","params":{"path":"src/App.jsx"}}
  Example: {"action":"terminal.run","params":{"command":"npm test"}}
  Note: this is for quick one-off requests typed in normal Chat (e.g. "read my package.json"). Multi-step coding tasks go through the dedicated Coding panel's agent loop, not this planner.

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