/**
 * ==========================================
 * BaseProvider
 * ------------------------------------------
 * Every AI provider (Gemini, OpenAI, Ollama...)
 * must extend this class.
 * ==========================================
 */

class BaseProvider {
    constructor(name) {
        this.name = name;
    }

    /**
     * Initialize provider.
     */
    async initialize() {
        throw new Error(
            `${this.name}: initialize() not implemented`
        );
    }

    /**
     * Generate complete response.
     *
     * @param {Array} contents
     */
    async generate(contents) {
        throw new Error(
            `${this.name}: generate() not implemented`
        );
    }

    /**
     * Stream response.
     *
     * @param {Array} contents
     * @param {Function} onChunk
     */
    async stream(contents, onChunk) {
        throw new Error(
            `${this.name}: stream() not implemented`
        );
    }

    /**
     * Health check.
     */
    async health() {
        return {
            provider: this.name,
            ready: true
        };
    }

    /**
     * Provider information.
     */
    info() {
        return {
            provider: this.name
        };
    }
}

module.exports = BaseProvider;