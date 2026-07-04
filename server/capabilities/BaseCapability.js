class BaseCapability {

    constructor(id, name) {
        this.id = id;
        this.name = name;
    }

    async initialize() {}

    async execute() {
        throw new Error("execute() not implemented");
    }

    metadata() {
        return {
            id: this.id,
            name: this.name
        };
    }

}

module.exports = BaseCapability;