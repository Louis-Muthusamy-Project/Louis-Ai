class BaseCapability {

    /**
     * @param {string} id
     * @param {string} name
     * @param {Object} [meta]
     * @param {string} [meta.description]
     * @param {string} [meta.permission] - e.g. "none", "user-data", "shell", "network"
     * @param {"low"|"medium"|"high"} [meta.riskLevel]
     * @param {number} [meta.timeoutMs]
     */
    constructor(id, name, meta = {}) {
        this.id = id;
        this.name = name;
        this.description = meta.description;
        this.permission = meta.permission;
        this.riskLevel = meta.riskLevel;
        this.timeoutMs = meta.timeoutMs;
    }

    async initialize() {}

    async execute() {
        throw new Error("execute() not implemented");
    }

    metadata() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            permission: this.permission,
            riskLevel: this.riskLevel,
            timeoutMs: this.timeoutMs
        };
    }

}

module.exports = BaseCapability;
