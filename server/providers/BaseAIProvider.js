class BaseAIProvider {

    async generate(contents) {
        throw new Error("generate() not implemented.");
    }

    async stream(contents, callbacks = {}) {
        throw new Error("stream() not implemented.");
    }

    getName() {
        return "base";
    }

}

module.exports = BaseAIProvider;