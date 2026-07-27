/**
 * ==========================================
 * Yuna ModuleRegistry
 * ==========================================
 */
class ModuleRegistry {
    constructor() {
        this.modules = new Map();
    }

    register(name, moduleInstance) {
        if (this.modules.has(name)) {
            throw new Error(`Module "${name}" is already registered.`);
        }
        this.modules.set(name, moduleInstance);
    }

    get(name) {
        return this.modules.get(name);
    }

    list() {
        return [...this.modules.keys()];
    }

    async initializeAll(kernel) {
        for (const [name, module] of this.modules.entries()) {
            if (typeof module.initialize === "function") {
                await module.initialize(kernel);
            }
        }
    }
}

module.exports = new ModuleRegistry();
