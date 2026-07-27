const fs = require("fs");
const path = require("path");

/**
 * ==========================================
 * Yuna PluginLoader - Dyn/Static Strategy Loader
 * ==========================================
 */
class PluginLoader {
    constructor() {
        this.plugins = [];
    }

    /**
     * Eagerly loads tools and registers them to ToolManager
     */
    async loadTools(toolManager) {
        const toolsPath = path.join(__dirname, "..", "tools", "system");
        if (!fs.existsSync(toolsPath)) return;

        const files = fs.readdirSync(toolsPath);
        for (const file of files) {
            if (file.endsWith("Tool.js")) {
                const ToolClass = require(path.join(toolsPath, file));
                toolManager.register(ToolClass);
            }
        }
    }

    /**
     * Eagerly loads capabilities and registers them to CapabilityRegistry
     */
    async loadCapabilities(capabilityRegistry) {
        const capabilitiesPath = path.join(__dirname, "..", "capabilities");
        if (!fs.existsSync(capabilitiesPath)) return;

        const files = fs.readdirSync(capabilitiesPath);
        for (const file of files) {
            if (file.endsWith("Capability.js") && file !== "BaseCapability.js") {
                const capability = require(path.join(capabilitiesPath, file));
                capabilityRegistry.register(capability);
            }
        }
    }
}

module.exports = new PluginLoader();
