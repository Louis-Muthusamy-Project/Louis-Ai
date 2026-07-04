class Agent {

    constructor({

        memory,

        provider,

        tools

    }) {

        this.memory = memory;

        this.provider = provider;

        this.tools = tools;

    }

    async run(userMessage) {

        return {

            reply: "",

            toolCalls: [],

            memory: []

        };

    }

}

module.exports = Agent;