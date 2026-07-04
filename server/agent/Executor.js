class Executor {

    constructor(toolManager) {

        this.toolManager = toolManager;

    }

    async execute(plan) {

        const results = [];

        for (const step of plan.steps) {

            if (step.type !== "tool") {

                continue;

            }

            const output = await this.toolManager.execute(

                step.tool,

                step.args

            );

            results.push(output);

        }

        return results;

    }

}

module.exports = Executor;