class BaseTool {

    constructor(name, description) {

        this.name = name;

        this.description = description;

    }

    async execute() {

        throw new Error("execute() not implemented.");

    }

    schema() {

        return {

            name: this.name,

            description: this.description

        };

    }

}

module.exports = BaseTool;