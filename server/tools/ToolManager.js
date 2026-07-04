class ToolManager {

    constructor() {

        this.tools = new Map();

    }

    register(tool) {

        this.tools.set(

            tool.name,

            tool

        );

    }

    get(name) {

        return this.tools.get(name);

    }

    list() {

        return [...this.tools.values()];

    }

    async execute(name, args = {}) {

        const tool = this.get(name);

        if (!tool) {

            throw new Error(

                `Tool ${name} not found.`

            );

        }

        return tool.execute(args);

    }

}

module.exports = new ToolManager();