const BaseAgent = require("./BaseAgent");

/**
 * AgentCoordinator - The central dispatcher for the Multi-Agent Architecture.
 * Receives user input and orchestrates the flow between Planner, Executor, and other agents.
 * Extends BaseAgent to leverage the EventBus and SharedContext.
 * 
 * @class AgentCoordinator
 * @extends BaseAgent
 */
class AgentCoordinator extends BaseAgent {
    /**
     * @param {Object} kernel - The Dependency Injection container.
     */
    constructor(kernel) {
        super("Coordinator", kernel);
        // Track active tasks
        this.activeTasks = new Map(); 
        this.activeControllers = new Map(); // Maps socketId -> AbortController
    }

    /**
     * Bootstraps the Coordinator by listening to task complete/error events.
     * @async
     */
    async start() {
        super.start();

        // Listen for task completion from specialized agents
        this.listen("agent:task:complete", async (payload) => {
            const { taskId, result, _sender } = payload;
            console.log(`[Agent:Coordinator] Task ${taskId} completed by ${_sender}.`);
            
            const taskContext = this.readContext(`task:${taskId}`);
            if (taskContext) {
                taskContext.resolve(result);
            }
        });

        this.listen("agent:task:error", async (payload) => {
            const { taskId, error, _sender } = payload;
            console.error(`[Agent:Coordinator] Task ${taskId} failed in ${_sender}: ${error}`);
            
            const taskContext = this.readContext(`task:${taskId}`);
            if (taskContext) {
                taskContext.reject(new Error(error));
            }
        });
    }

    /**
     * Entry point for a user message.
     * 1. Ask Planner Agent to create a plan.
     * 2. Execute plan steps by broadcasting to specialized agents.
     * 3. Return final result.
     * 
     * @async
     * @returns {Promise<Object>} The synthesized response payload.
     */
    async handleUserMessage(socketId, text, context, intentResult) {
        // Setup AbortController for this session
        if (this.activeControllers.has(socketId)) {
            // Cancel previous active task for this user
            this.cancelActiveTask(socketId);
        }
        
        const controller = new AbortController();
        this.activeControllers.set(socketId, controller);
        const signal = controller.signal;

        this.broadcast("user.message.received", { socketId, text });
        
        console.log(`[Agent:Coordinator] Handling message: "${text}" with intent: ${intentResult.intent}`);
        
        this.broadcast("ai.thinking.started", { socketId });

        // Let Planner agent process intent and plan
        const planResult = await this.kernel.get("taskPlanner").plan(context, intentResult);
        
        this.broadcast("plan.created", { socketId, steps: planResult.steps });

        if (!planResult.steps || planResult.steps.length === 0) {
            return { type: "chat", message: null }; // Pass to Response Processor for normal chat
        }

        let finalResponse = "";
        let completedSteps = [];
        let failedStep = null;
        
        // Execute steps in the plan
        for (const step of planResult.steps) {
            const agentName = this.resolveAgentForCapability(step.capability);
            const capabilityMeta = this.kernel.get("capabilityRegistry").get(step.capability);
            
            console.log(`[Agent:Coordinator] Executing step: ${step.capability} via ${agentName}`);
            
            try {
                // Permission / Risk Pipeline
                if (capabilityMeta && capabilityMeta.riskLevel !== "low") {
                    const permissionService = this.kernel.get("permissionService");
                    const granted = await permissionService.requestPermission(
                        socketId, 
                        step.capability, 
                        capabilityMeta.riskLevel, 
                        step.args
                    );
                    
                    if (!granted) {
                        throw new Error(`Permission denied for capability: ${step.capability}`);
                    }
                }

                if (signal.aborted) {
                    throw new Error("Task execution was cancelled.");
                }

                this.broadcast("task.started", { socketId, capability: step.capability });
                // Note: delegateTask should pass signal down to agents
                const stepResult = await this.delegateTask(agentName, step.capability, step.args, signal);
                this.broadcast("task.completed", { socketId, capability: step.capability, result: stepResult });
                
                completedSteps.push({ capability: step.capability, result: stepResult });
                finalResponse += `\nStep ${step.capability} completed: ${stepResult.message || "Success"}`;
            } catch (error) {
                const isCancellation = error.message.includes("cancelled") || (error.name === "AbortError");
                this.broadcast("task.failed", { socketId, capability: step.capability, error: error.message, cancelled: isCancellation });
                failedStep = { capability: step.capability, error: error.message, cancelled: isCancellation };
                finalResponse += `\nStep ${step.capability} ${isCancellation ? "cancelled" : "failed"}: ${error.message}`;
                break; // Stop plan on failure or cancellation
            }
        }

        this.activeControllers.delete(socketId);

        return {
            type: failedStep ? "partial_failure" : "success",
            completedSteps,
            failedStep,
            message: finalResponse
        };
    }

    /**
     * Cancels any active tasks for the given socket ID
     */
    cancelActiveTask(socketId) {
        const controller = this.activeControllers.get(socketId);
        if (controller) {
            console.log(`[Agent:Coordinator] Cancelling active tasks for socket ${socketId}`);
            controller.abort();
            this.activeControllers.delete(socketId);
        }
    }

    /**
     * Resolves which agent should handle a given capability namespace.
     * @param {string} capability 
     */
    resolveAgentForCapability(capability) {
        if (!capability) return "Executor";
        
        if (capability.startsWith("browser.")) return "Browser";
        if (capability.startsWith("coding.")) return "Coding";
        if (capability.startsWith("memory.")) return "Memory";
        if (capability.startsWith("vision.")) return "Vision";
        if (capability.startsWith("voice.")) return "Voice";
        if (capability.startsWith("system.")) return "Automation";
        
        return "Executor"; // Generic fallback
    }

    /**
     * Delegates a specific task to an agent and waits for completion over the EventBus.
     * Utilizes the SharedContext to track promise callbacks.
     * 
     * @param {string} agentName - The target agent name.
     * @param {string} action - The action/capability to execute.
     * @param {Object} params - The arguments payload.
     * @param {AbortSignal} signal - Optional cancellation signal.
     * @returns {Promise<any>}
     */
    delegateTask(agentName, action, params, signal) {
        return new Promise((resolve, reject) => {
            const taskId = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

            const onComplete = (payload) => {
                if (payload.taskId === taskId) {
                    cleanup();
                    resolve(payload.result);
                }
            };

            const onError = (payload) => {
                if (payload.taskId === taskId) {
                    cleanup();
                    reject(new Error(payload.error));
                }
            };

            const onAbort = () => {
                cleanup();
                reject(new Error("AbortError"));
            };

            const cleanup = () => {
                this.kernel.get("eventBus").removeListener('agent:task:complete', onComplete);
                this.kernel.get("eventBus").removeListener('agent:task:error', onError);
                if (signal) {
                    signal.removeEventListener("abort", onAbort);
                }
            };

            this.kernel.get("eventBus").on('agent:task:complete', onComplete);
            this.kernel.get("eventBus").on('agent:task:error', onError);
            
            if (signal) {
                if (signal.aborted) {
                    return onAbort();
                }
                signal.addEventListener("abort", onAbort);
            }

            // Broadcast the task request
            this.broadcast(`agent:${agentName}:request`, {
                taskId,
                action,
                params
            });

            // Fallback timeout to prevent hanging
            setTimeout(() => {
                const taskContext = this.readContext(`task:${taskId}`);
                if (taskContext) {
                    this.writeContext(`task:${taskId}`, null);
                    reject(new Error(`Task ${taskId} timed out after 30s.`));
                }
            }, 30000);
        });
    }
}

module.exports = AgentCoordinator;
