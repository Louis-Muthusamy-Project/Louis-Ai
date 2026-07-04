class BaseTTSProvider {

    async synthesize() {
        throw new Error("synthesize() not implemented.");
    }

    async stream() {
        throw new Error("stream() not implemented.");
    }

    async getVoices() {
        return [];
    }

}

module.exports = BaseTTSProvider;