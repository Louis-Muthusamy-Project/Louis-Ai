const Module = require("../core/Module");

class ConversationModule extends Module {

    constructor() {

        super("conversation");

    }

    async initialize() {

        console.log("Conversation Module Loaded");

    }

}

module.exports = new ConversationModule();