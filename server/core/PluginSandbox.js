const vm = require("vm");
const path = require("path");

/**
 * ==========================================
 * ScopedKernelFacade
 * ------------------------------------------
 * Previously every plugin received the raw, live Kernel DI container
 * (context.kernel = this.kernel), meaning ANY plugin - regardless of
 * its declared manifest scopes - could do kernel.get("userRepository")
 * or any other registered service, completely bypassing the `apis`
 * scoping below. This facade keeps the same shape plugins already use
 * (`this.kernel.get(name)`, per PluginSDK.js) but only allows lookups
 * the plugin's declared scopes actually cover.
 * ==========================================
 */
class ScopedKernelFacade {
    constructor(kernel, scopes, manifest) {
        this._kernel = kernel;
        this._scopes = new Set(scopes || []);
        this._manifest = manifest;
    }

    get(serviceName) {
        const permitted = Object.entries(ScopedKernelFacade.ALLOWED_BY_SCOPE).some(
            ([scope, services]) => this._scopes.has(scope) && services.includes(serviceName)
        );
        if (!permitted) {
            throw new Error(
                `Plugin ${this._manifest.name} attempted kernel.get("${serviceName}") without a declared scope that permits it.`
            );
        }
        return this._kernel.get(serviceName);
    }
}

// scope -> the only kernel service names that scope unlocks.
ScopedKernelFacade.ALLOWED_BY_SCOPE = {
    memory: ["memoryService"],
    schedule: ["scheduleService"],
    settings: ["settingsService"],
    events: ["eventBus"]
};

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

        // Inject Kernel resources - each gated behind its own declared scope.
        if (scopes.includes("events")) {
            apis.eventBus = this.kernel.get("eventBus");
        }

        if (scopes.includes("tools")) {
            apis.toolManager = require("../tools");
        }

        if (scopes.includes("memory")) {
            apis.memoryService = this.kernel.get("memoryService");
        }

        if (scopes.includes("schedule")) {
            apis.scheduleService = this.kernel.get("scheduleService");
        }

        if (scopes.includes("browser")) {
            apis.browserCapability = this.kernel.get("capabilityRegistry").get("browser");
        }

        if (scopes.includes("coding")) {
            apis.codingCapability = this.kernel.get("capabilityRegistry").get("coding");
        }

        sandbox.context = {
            // A scoped facade, NOT the raw Kernel - see ScopedKernelFacade above.
            // Plugins keep the same this.kernel.get(name) shape (PluginSDK.js),
            // but lookups outside their declared scopes now throw.
            kernel: new ScopedKernelFacade(this.kernel, scopes, manifest),
            manifest,
            apis
        };

        return vm.createContext(sandbox);
    }

    _createScopedRequire(scopes, manifest) {
        // Previously this only blocked the literal strings "fs",
        // "child_process", and "net" - everything else, including a
        // "node:fs" prefix (which bypasses the literal-string check
        // entirely) or any third-party package already installed in
        // server/node_modules (puppeteer, mongoose, axios, ...), fell
        // through to the real, unrestricted require(). That made the
        // "scopes" system decorative for require access. This replaces
        // it with an allowlist: safe built-ins are always available,
        // risk-bearing built-ins require their scope, and everything
        // else (arbitrary npm packages) is rejected outright rather
        // than silently permitted.
        const ALWAYS_ALLOWED = new Set([
            "path", "url", "querystring", "util", "events",
            "crypto", "assert", "buffer", "string_decoder"
        ]);

        const SCOPE_GATED = {
            fs: "fs",
            child_process: "child_process",
            net: "network",
            http: "network",
            https: "network",
            dgram: "network",
            dns: "network",
            tls: "network",
            os: "system",
            vm: "system",
            module: "system",
            worker_threads: "system"
        };

        return (moduleName) => {
            // Normalize "node:fs" -> "fs" so the node: prefix can't be used
            // to bypass the checks below.
            const normalized = moduleName.replace(/^node:/, "");

            if (normalized === "@yuna/sdk" || moduleName === "@yuna/sdk") {
                return require("../plugins/PluginSDK");
            }

            if (ALWAYS_ALLOWED.has(normalized)) {
                return require(normalized);
            }

            const requiredScope = SCOPE_GATED[normalized];
            if (requiredScope) {
                if (!scopes.includes(requiredScope)) {
                    throw new Error(`Plugin ${manifest.name} attempted to require '${normalized}' without the '${requiredScope}' scope.`);
                }
                return require(normalized);
            }

            // Not an allowlisted built-in and not an explicitly scoped one -
            // this covers both unknown Node built-ins and any third-party
            // package (npm dependency) reachable from server/node_modules.
            // Plugins get functionality through the `apis` object (scoped
            // per manifest), not by requiring arbitrary packages.
            throw new Error(`Plugin ${manifest.name} attempted to require '${moduleName}', which is not permitted. Use the scoped apis object instead.`);
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
