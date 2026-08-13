/**
 * Base class for Yuna Plugins.
 * All plugins must extend this class and implement the lifecycle methods.
 */
class YunaPlugin {
    /**
     * @param {Object} context The plugin context provided by the PluginSandbox
     * @param {Object} context.kernel The system kernel (DI container)
     * @param {Object} context.manifest The parsed manifest.json of the plugin
     * @param {Object} context.apis Scoped APIs exposed to the plugin based on manifest
     */
    constructor(context) {
        this.context = context;
        this.manifest = context.manifest;
        this.kernel = context.kernel;
        this.apis = context.apis;
    }

    /**
     * Called when the plugin is first loaded into memory.
     * Use this for initial setup that doesn't require interacting with other plugins.
     */
    async onLoad() {}

    /**
     * Called when the plugin is enabled (or after hot-reload).
     * Register events, tools, or start processes here.
     */
    async onEnable() {}

    /**
     * Called when the plugin is disabled (e.g., before a hot-reload or system shutdown).
     * Unregister events, clear intervals, and clean up resources here.
     */
    async onDisable() {}

    /**
     * Called when the plugin is completely unloaded from memory.
     */
    async onUnload() {}
}

module.exports = { YunaPlugin };
