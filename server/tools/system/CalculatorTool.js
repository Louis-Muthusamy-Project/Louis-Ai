const BaseTool = require("../BaseTool");

class CalculatorTool extends BaseTool {

    constructor() {

        super(

            "calculator",

            "Performs arithmetic."

        );

    }

    async execute({

        expression

    }) {

        try {

            const result = Function(

                `"use strict"; return (${expression})`

            )();

            return {

                success: true,

                result

            };

        }

        catch {

            return {

                success: false

            };

        }

    }

}

module.exports = new CalculatorTool;