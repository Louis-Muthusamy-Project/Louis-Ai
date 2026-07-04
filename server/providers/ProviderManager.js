const GeminiProvider = require("./GeminiProvider");

class ProviderManager {

    constructor() {

        this.provider = new GeminiProvider();

    }

    async generate(contents) {

        return this.provider.generate(contents);

    }

    async stream(contents, callbacks = {}) {

        return this.provider.stream(

            contents,

            callbacks

        );

    }

    getProviderName() {

        return this.provider.getName();

    }

}

module.exports = new ProviderManager();