class CapabilityRegistry {

    constructor() {

        this.capabilities = new Map();

    }

    register(capability) {

        this.capabilities.set(
            capability.id,
            capability
        );

    }

    get(id) {

        return this.capabilities.get(id);

    }

    list() {

        return [...this.capabilities.values()];

    }

    async initialize() {

        for (const capability of this.list()) {

            await capability.initialize();

        }

    }

}

module.exports = new CapabilityRegistry();