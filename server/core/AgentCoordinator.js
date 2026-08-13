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
     * @param {string} socketId - The originating user's socket session.
     * @param {string} text - The user's input text.
     * @returns {Promise<string>} The synthesized response text.
     */
    async handleUserMessage(socketId, text) {
        console.log(`[Agent:Coordinator] Handling message: "${text}"`);
        
        // Let Planner agent process intent and plan
        const planResult = await this.delegateTask("Planner", "create_plan", { text, socketId });
        
        if (planResult.directReply) {
            return planResult.directReply;
        }

        let finalResponse = "";
        
        // Execute steps in the plan
        for (const step of planResult.steps) {
            console.log(`[Agent:Coordinator] Executing step: ${step.action} via ${step.agent}`);
            
            try {
                const stepResult = await this.delegateTask(step.agent, step.action, step.params);
                finalResponse += `\nStep ${step.action} completed: ${stepResult.message || "Success"}`;
            } catch (error) {
                finalResponse += `\nStep ${step.action} failed: ${error.message}`;
                break; // Stop plan on failure
            }
        }

        return finalResponse || "I have completed the tasks.";
    }

    /**
     * Delegates a specific task to an agent and waits for completion over the EventBus.
     * Utilizes the SharedContext to track promise callbacks.
     * 
     * @param {string} agentName - Target agent's name (e.g. 'Browser')
     * @param {string} action - The action identifier (e.g. 'search')
     * @param {Object} params - The payload dictionary
     * @returns {Promise<Object>} The completed result payload from the agent.
     */
    delegateTask(agentName, action, params) {
        return new Promise((resolve, reject) => {
            const taskId = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            
            // Store promise callbacks in SharedContext so the listener can resolve them
            this.writeContext(`task:${taskId}`, { resolve, reject, agentName, action });

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
