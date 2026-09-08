const CodingModelProvider = require("./CodingModelProvider");

/**
 * ==========================================
 * ClaudeCodingProvider
 * ------------------------------------------
 * Adapts AnthropicProvider.generateWithTools() to the common
 * CodingModelProvider interface. History shape here is
 * { system: string, messages: Array } matching the Anthropic Messages API
 * directly - `messages` alternates role "user"/"assistant", exactly what
 * client.messages.create() expects.
 * ==========================================
 */
class ClaudeCodingProvider extends CodingModelProvider {
    constructor(anthropicProvider) {
        super();
        this.anthropicProvider = anthropicProvider;
    }

    getName() {
        return "claude";
    }

    isConfigured() {
        return !!(this.anthropicProvider && process.env.ANTHROPIC_API_KEY);
    }

    buildInitialHistory(taskText, systemInstruction) {
        return {
            system: systemInstruction || "",
            messages: [{ role: "user", content: taskText }]
        };
    }

    async sendTurn(history, tools) {
        const response = await this.anthropicProvider.generateWithTools(history.system, history.messages, tools);

        // Stashed so appendModelTurn() can replay Claude's own content
        // blocks (text + tool_use) as the assistant turn.
        this._lastContent = response.content || [];

        const functionCalls = this._lastContent
            .filter((block) => block.type === "tool_use")
            .map((block) => ({ id: block.id, name: block.name, args: block.input || {} }));

        const text = this._lastContent
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n");

        return { functionCalls, text };
    }

    appendModelTurn(history) {
        return { ...history, messages: [...history.messages, { role: "assistant", content: this._lastContent }] };
    }

    appendFunctionResultsTurn(history, callsWithResults) {
        // Claude expects all tool results for the preceding assistant
        // turn's tool_use blocks batched into ONE user message, same
        // convention as Gemini.
        const content = callsWithResults.map(({ call, result }) => ({
            type: "tool_result",
            tool_use_id: call.id,
            content: this._safeStringify(result),
            is_error: !(result && result.success)
        }));
        return { ...history, messages: [...history.messages, { role: "user", content }] };
    }

    _safeStringify(result) {
        try {
            return JSON.stringify(result);
        } catch {
            return JSON.stringify({ success: false, message: "Tool result could not be serialized." });
        }
    }
}

module.exports = ClaudeCodingProvider;
