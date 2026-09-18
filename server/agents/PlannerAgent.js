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
                    // NOTE: this event is not emitted anywhere in the live codebase
                    // (dead code path, see the pre-existing note below) - userId is
                    // threaded through best-effort so this doesn't silently break if
                    // something ever does wire it up. intentDetector/taskPlanner both
                    // require an authenticated userId to resolve a per-user provider
                    // credential (see ProviderManager.resolveForUser) - never the
                    // boot-time env-based singleton.
                    const userId = payload.userId || payload.ownerId;
                    const detectionResult = await intentDetector.detect(text, userId);
                    
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
                    const plan = await taskPlanner.plan({}, detectionResult, userId);

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
