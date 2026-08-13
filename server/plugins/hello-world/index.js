const { YunaPlugin } = require("@yuna/sdk");

class HelloWorldPlugin extends YunaPlugin {
    async onLoad() {
        this.apis.log("HelloWorldPlugin has been loaded into memory!");
    }

    async onEnable() {
        this.apis.log("HelloWorldPlugin is now enabled and running!");
        
        // Example: access memory service
        if (this.apis.memoryService) {
            this.apis.log("Memory service is available due to requested scopes.");
        }
    }

    async onDisable() {
        this.apis.warn("HelloWorldPlugin is being disabled. Cleaning up resources...");
    }

    async onUnload() {
        this.apis.log("HelloWorldPlugin unloaded.");
    }
}

module.exports = HelloWorldPlugin;
