/**
 * ==========================================
 * Yuna Kernel - DI Container & Coordinator
 * ==========================================
 */

class Kernel {
    constructor() {
        this.bindings = new Map();
        this.instances = new Map();
    }

    /**
     * Registers a service, factory, or instance binding.
     * @param {string} key Unique identifier for the dependency
     * @param {any} definition Constructor, factory function, or direct singleton instance
     * @param {object} options Options: { singleton: true, lazy: true }
     */
    register(key, definition, options = {}) {
        const config = {
            singleton: true,
            lazy: true,
            ...options
        };

        if (this.bindings.has(key)) {
            throw new Error(`Dependency "${key}" is already registered in Kernel.`);
        }

        this.bindings.set(key, { definition, config });

        if (!config.lazy) {
            this.resolve(key);
        }
    }

    /**
     * Resolves and returns a dependency.
     * @param {string} key Unique identifier
     */
    get(key) {
        return this.resolve(key);
    }

    /**
     * Check if a dependency is bound.
     */
    has(key) {
        return this.bindings.has(key);
    }

    /**
     * Resolve logic with support for factory execution and instance caching.
     */
    resolve(key) {
        if (!this.bindings.has(key)) {
            throw new Error(`Cannot resolve unregistered dependency "${key}".`);
        }

        const { definition, config } = this.bindings.get(key);

        if (config.singleton && this.instances.has(key)) {
            return this.instances.get(key);
        }

        let resolvedValue;

        if (typeof definition === "function") {
            // If it's a class constructor or factory function
            if (definition.prototype && definition.prototype.constructor === definition) {
                // Instantiate class, passing container reference for potential DI
                resolvedValue = new definition(this);
            } else {
                // Execute factory function
                resolvedValue = definition(this);
            }
        } else {
            // Direct instance
            resolvedValue = definition;
        }

        if (config.singleton) {
            this.instances.set(key, resolvedValue);
        }

        return resolvedValue;
    }

    /**
     * Clears all container bindings and instances.
     */
    reset() {
        this.bindings.clear();
        this.instances.clear();
    }
}

module.exports = new Kernel();
