const BaseTool = require("../BaseTool");

class TimeTool extends BaseTool {

    constructor() {

        super(

            "time",

            "Returns current date and time."

        );

    }

    async execute() {

        return {

            success: true,

            now: new Date().toISOString()

        };

    }

}

module.exports = new TimeTool();