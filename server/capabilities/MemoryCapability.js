const BaseCapability = require("./BaseCapability");

class MemoryCapability extends BaseCapability {

    constructor() {

        super(
            "memory",
            "Conversation Memory"
        );

    }

    async execute(input) {

        return {

            success: true,

            data: input

        };

    }

}

module.exports = new MemoryCapability();