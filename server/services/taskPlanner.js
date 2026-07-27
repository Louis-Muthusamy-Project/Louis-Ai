/**
 * ==========================================
 * TaskPlanner - Sequencer for multi-step tasks
 * ==========================================
 */
class TaskPlanner {
    constructor(kernel) {
        this.kernel = kernel;
    }

    /**
     * Generates an execution plan based on detected intent.
     * @param {Object} detectionResult { intent, tool, args }
     * @returns {Object} Plan structure: { steps: [{ tool, args }] }
     */
    plan(detectionResult) {
        const { intent, tool, args } = detectionResult;
        
        if (intent === "USE_TOOL" && tool) {
            return {
                steps: [
                    {
                        tool,
                        args: args || {}
                    }
                ]
            };
        }

        return { steps: [] };
    }
}

module.exports = TaskPlanner;
