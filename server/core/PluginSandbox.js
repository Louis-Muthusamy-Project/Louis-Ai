const vm = require("vm");
const path = require("path");

/**
 * ==========================================
 * PluginSandbox - Scoped Context Isolation
 * ==========================================
 * Wraps plugin execution inside a Node VM to control 
 * which global modules and core APIs are accessible.
 */
class PluginSandbox {
    constructor(kernel) {
        this.kernel = kernel;
    }

    /**
     * Creates a VM context for a plugin based on requested scopes.
     * @param {Object} manifest The plugin's manifest.json
     * @returns {Object} The sandbox context
     */
    createContext(manifest) {
        const scopes = manifest.scopes || [];
        
        // Base allowed globals
        const sandbox = {
            console,
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval,
            setImmediate,
            clearImmediate,
            Buffer,
            URL,
            URLSearchParams,
            process: {
                env: { NODE_ENV: process.env.NODE_ENV } // Limit env vars
            },
            // We provide a safe require function
            require: this._createScopedRequire(scopes, manifest)
        };

        // Injects standard APIs
        const apis = {
            log: (message) => console.log(`[Plugin:${manifest.name}] ${message}`),
            warn: (message) => console.warn(`[Plugin:${manifest.name}] ${message}`),
            error: (message) => console.error(`[Plugin:${manifest.name}] ${message}`)
        };

        // Inject Kernel resources (we could restrict this further based on scopes)
        if (scopes.includes("events")) {
            apis.eventBus = this.kernel.get("eventBus");
        }

        if (scopes.includes("tools")) {
            apis.toolManager = require("../tools");
        }

        if (scopes.includes("memory")) {
            apis.memoryService = this.kernel.get("memoryService");
        }

        sandbox.context = {
            kernel: this.kernel,
            manifest,
            apis
        };

        return vm.createContext(sandbox);
    }

    _createScopedRequire(scopes, manifest) {
        return (moduleName) => {
            // Built-in node modules scope restrictions
            if (moduleName === "fs" && !scopes.includes("fs")) {
                throw new Error(`Plugin ${manifest.name} attempted to require 'fs' without the 'fs' scope.`);
            }
            if (moduleName === "child_process" && !scopes.includes("child_process")) {
                throw new Error(`Plugin ${manifest.name} attempted to require 'child_process' without the 'child_process' scope.`);
            }
            if (moduleName === "net" && !scopes.includes("network")) {
                throw new Error(`Plugin ${manifest.name} attempted to require 'net' without the 'network' scope.`);
            }

            // Also allow the plugin to require the SDK
            if (moduleName === "@yuna/sdk") {
                return require("../plugins/PluginSDK");
            }

            // Normal require (for safe node modules or plugin local files)
            // Note: A true robust sandbox would map this to the plugin's local directory only.
            // For this implementation, we fallback to standard require.
            return require(moduleName);
        };
    }

    /**
     * Executes the plugin's main script within the sandbox context.
     * @param {string} scriptContent The JS code of the plugin entry point
     * @param {Object} manifest The plugin's manifest
     * @returns {Object} The instantiated Plugin class
     */
    evaluate(scriptContent, manifest) {
        const context = this.createContext(manifest);
        
        // We wrap the script to return the class or module.exports
        const wrappedScript = `
            const module = { exports: {} };
            const exports = module.exports;
            (function(module, exports, require, context) {
                ${scriptContent}
            })(module, exports, require, context);
            module.exports;
        `;

        const script = new vm.Script(wrappedScript, { filename: manifest.name + ".js" });
        const pluginModule = script.runInContext(context);
        
        // Find the exported class that extends YunaPlugin
        for (const key in pluginModule) {
            const Exported = pluginModule[key];
            if (typeof Exported === 'function' && Exported.prototype && Exported.prototype.onEnable) {
                return new Exported(context.context);
            }
        }
        
        // Fallback: assume the export itself is the class or instance
        if (typeof pluginModule === 'function' && pluginModule.prototype && pluginModule.prototype.onEnable) {
            return new pluginModule(context.context);
        }

        throw new Error(`Plugin ${manifest.name} did not export a valid YunaPlugin class.`);
    }
}

module.exports = PluginSandbox;
