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
                    
                    if (!detectionResult.requiresTool || detectionResult.intent === "conversation" || detectionResult.intent === "question") {
                        // Direct reply, no tools needed
                        this.broadcast("agent:task:complete", {
                            taskId,
                            result: { directReply: true, intent: detectionResult.intent }
                        });
                        return;
                    }

                    // NOTE: taskPlanner.plan(context, detectionResult) is async and
                    // returns { steps: [{ capability, args }] } - this previously
                    // called plan(detectionResult) (wrong arg count, not awaited)
                    // and then read step.tool (the field is actually step.capability),
                    // meaning this whole non-conversational path always threw before
                    // reaching any agent/capability. Both are fixed here.
                    const plan = await taskPlanner.plan({}, detectionResult);

                    const agentSteps = plan.steps.map(step => {
                        let agent = "Executor";
                        if (step.capability?.startsWith("coding")) agent = "Coding";
                        if (step.capability?.startsWith("browser")) agent = "Browser";
                        if (step.capability?.startsWith("schedule")) agent = "Automation";
                        if (step.capability?.startsWith("image")) agent = "Automation";

                        return {
                            agent,
                            action: step.capability,
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
