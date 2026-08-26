const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const PluginSandbox = require("./PluginSandbox");

/**
 * ==========================================
 * PluginManager - Advanced Plugin System
 * ==========================================
 * Handles dynamic discovery, loading, lifecycle,
 * and hot-reloading of marketplace-ready plugins.
 */
class PluginManager {
    constructor(kernel) {
        this.kernel = kernel;
        this.pluginsPath = path.join(__dirname, "..", "plugins");
        this.activePlugins = new Map(); // name -> instance
        this.pluginMetadata = new Map(); // name -> manifest
        this.watchers = new Map(); // name -> FSWatcher
        this.sandbox = new PluginSandbox(kernel);
    }

    /**
     * Initializes the manager, loading all plugins in the plugins directory.
     */
    async initialize() {
        if (!fs.existsSync(this.pluginsPath)) {
            fs.mkdirSync(this.pluginsPath, { recursive: true });
        }

        const entries = fs.readdirSync(this.pluginsPath, { withFileTypes: true });
        
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const pluginDir = path.join(this.pluginsPath, entry.name);
                await this.loadPlugin(pluginDir);
            }
        }
    }

    /**
     * Loads a single plugin from a directory.
     * @param {string} pluginDir Absolute path to the plugin directory
     */
    async loadPlugin(pluginDir) {
        const manifestPath = path.join(pluginDir, "manifest.json");
        
        if (!fs.existsSync(manifestPath)) {
            return; // Not a valid plugin
        }

        try {
            const manifestStr = fs.readFileSync(manifestPath, "utf-8");
            const manifest = JSON.parse(manifestStr);
            const mainFile = manifest.main || "index.js";
            const mainPath = path.join(pluginDir, mainFile);

            if (!fs.existsSync(mainPath)) {
                throw new Error(`Main entry file ${mainFile} not found.`);
            }

            const scriptContent = fs.readFileSync(mainPath, "utf-8");
            
            // Execute in Sandbox
            const pluginInstance = this.sandbox.evaluate(scriptContent, manifest);
            
            this.activePlugins.set(manifest.name, pluginInstance);
            this.pluginMetadata.set(manifest.name, manifest);

            // Trigger lifecycle
            await pluginInstance.onLoad();
            await pluginInstance.onEnable();

            console.log(`[PluginManager] Loaded plugin: ${manifest.name} v${manifest.version}`);

            // Setup Hot-Reload watcher
            this.setupWatcher(manifest.name, pluginDir, mainPath);
        } catch (error) {
            console.error(`[PluginManager] Failed to load plugin at ${pluginDir}:`, error.message);
        }
    }

    /**
     * Unloads an active plugin and triggers onDisable/onUnload.
     * @param {string} pluginName The name of the plugin
     */
    async unloadPlugin(pluginName) {
        if (this.activePlugins.has(pluginName)) {
            const instance = this.activePlugins.get(pluginName);
            try {
                await instance.onDisable();
                await instance.onUnload();
                console.log(`[PluginManager] Unloaded plugin: ${pluginName}`);
            } catch (error) {
                console.error(`[PluginManager] Error disabling plugin ${pluginName}:`, error.message);
            }
            this.activePlugins.delete(pluginName);
            this.pluginMetadata.delete(pluginName);
            
            if (this.watchers.has(pluginName)) {
                this.watchers.get(pluginName).close();
                this.watchers.delete(pluginName);
            }
        }
    }

    /**
     * Sets up a file watcher for Hot-Reload.
     */
    setupWatcher(pluginName, pluginDir, mainPath) {
        if (this.watchers.has(pluginName)) return;

        const watcher = chokidar.watch(pluginDir, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true
        });

        let reloadTimeout = null;

        watcher.on("all", (event, filePath) => {
            if (event === "change" || event === "add") {
                // Debounce reload
                clearTimeout(reloadTimeout);
                reloadTimeout = setTimeout(async () => {
                    console.log(`[PluginManager] Hot-reloading plugin: ${pluginName} due to changes.`);
                    await this.unloadPlugin(pluginName); // Unload the old instance
                    await this.loadPlugin(pluginDir);    // Load the new instance
                }, 500);
            }
        });

        this.watchers.set(pluginName, watcher);
    }

    async shutdown() {
        for (const [pluginName, watcher] of this.watchers) {
            try {
                await watcher.close();
            } catch (error) {
                console.error(`[PluginManager] Error closing watcher for ${pluginName}:`, error.message);
            }
        }
        this.watchers.clear();
    }
}

module.exports = PluginManager;