const Planner = require("./Planner");
const Executor = require("./Executor");

const ToolManager = require("../tools");

const executor = new Executor(

    ToolManager

);

module.exports = {

    async run(message) {

        const plan = await Planner.createPlan(

            message

        );

        const toolResults =

            await executor.execute(plan);

        return {

            plan,

            toolResults

        };

    }

};