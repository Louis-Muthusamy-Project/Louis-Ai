class YunaKernel {

    constructor() {

        this.modules = new Map();

    }

    register(name, instance) {

        if (this.modules.has(name)) {

            throw new Error(`${name} already registered`);

        }

        this.modules.set(name, instance);

    }

    get(name) {

        return this.modules.get(name);

    }

    has(name) {

        return this.modules.has(name);

    }

    remove(name) {

        this.modules.delete(name);

    }

    list() {

        return [...this.modules.keys()];

    }

}

module.exports = new YunaKernel();