class BaseAIProvider {

    async generate(contents) {
        throw new Error("generate() not implemented.");
    }

    async stream(contents, callbacks = {}) {
        throw new Error("stream() not implemented.");
    }

    async embed(text) {
        throw new Error("embed() not implemented.");
    }

    getName() {
        return "base";
    }

}

module.exports = BaseAIProvider;