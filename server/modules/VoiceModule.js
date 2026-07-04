const Module = require("../core/Module");

class VoiceModule extends Module {

    constructor() {

        super("voice");

    }

    async initialize() {

        console.log("Voice Module Loaded");

    }

}

module.exports = new VoiceModule();