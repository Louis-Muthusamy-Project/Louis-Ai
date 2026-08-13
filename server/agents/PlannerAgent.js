const BaseAgent = require("../core/BaseAgent");

class PlannerAgent extends BaseAgent {
    constructor(kernel) {
        super("Planner", kernel);
    }

    async start() {
        super.start();
        
        const intentDetector = this.kernel.get("intentDetector");
        const taskPlanner = this.kernel.get("taskPlanner");

        this.listen("agent:Planner:request", async (payload) => {
            const { taskId, action, params } = payload;
            
            if (action === "create_plan") {
                try {
                    const text = params.text;
                    const detectionResult = await intentDetector.detect(text);
                    
                    if (detectionResult.intent === "CHAT") {
                        // Direct reply, no tools needed
                        this.broadcast("agent:task:complete", {
                            taskId,
                            result: { directReply: true, intent: "CHAT" }
                        });
                        return;
                    }

                    const plan = taskPlanner.plan(detectionResult);
                    
                    // Transform old tool-based plan to new agent-based plan
                    // For now, map all tools to ExecutorAgent except specific ones
                    const agentSteps = plan.steps.map(step => {
                        let agent = "Executor";
                        if (step.tool === "coding") agent = "Coding";
                        if (step.tool === "browser") agent = "Browser";
                        if (step.tool === "schedule") agent = "Automation";

                        return {
                            agent,
                            action: step.tool,
                            params: step.args
                        };
                    });

                    this.broadcast("agent:task:complete", {
                        taskId,
                        result: { directReply: false, steps: agentSteps }
                    });
                } catch (error) {
                    this.broadcast("agent:task:error", {
                        taskId,
                        error: error.message
                    });
                }
            }
        });
    }
}

module.exports = PlannerAgent;
