const Module = require("../core/Module");

class MemoryModule extends Module {

    constructor() {

        super("memory");

    }

    async initialize() {

        console.log("Memory Module Loaded");

    }

}

module.exports = new MemoryModule();