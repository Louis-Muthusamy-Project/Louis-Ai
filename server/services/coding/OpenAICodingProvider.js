const CodingModelProvider = require("./CodingModelProvider");

/**
 * ==========================================
 * OpenAICodingProvider
 * ------------------------------------------
 * Adapts OpenAIProvider.generateWithTools() (Responses API) to the common
 * CodingModelProvider interface. History shape here is
 * { instructions: string, input: Array } - `input` is the Responses API's
 * flat conversation array; `instructions` carries the system prompt
 * separately (the Responses API takes them as separate params, unlike
 * Gemini which has no distinct system-turn concept).
 * ==========================================
 */
class OpenAICodingProvider extends CodingModelProvider {
    constructor(openAIProvider) {
        super();
        this.openAIProvider = openAIProvider;
    }

    getName() {
        return "openai";
    }

    isConfigured() {
        return !!(this.openAIProvider && process.env.OPENAI_API_KEY);
    }

    buildInitialHistory(taskText, systemInstruction) {
        return {
            instructions: systemInstruction || "",
            input: [{ role: "user", content: taskText }]
        };
    }

    async sendTurn(history, tools) {
        const response = await this.openAIProvider.generateWithTools(history.instructions, history.input, tools);

        // Stashed so appendModelTurn() (called right after, same tick) can
        // replay the exact output items OpenAI returned - the Responses
        // API docs are explicit that output items should be preserved in
        // order when managing history manually.
        this._lastOutput = response.output || [];

        const functionCalls = this._lastOutput
            .filter((item) => item.type === "function_call")
            .map((item) => ({
                id: item.call_id,
                name: item.name,
                args: this._safeParseArgs(item.arguments)
            }));

        return { functionCalls, text: response.output_text || "" };
    }

    appendModelTurn(history) {
        return { ...history, input: [...history.input, ...this._lastOutput] };
    }

    appendFunctionResultsTurn(history, callsWithResults) {
        // Unlike Gemini/Claude, the Responses API's function_call_output
        // items are independent top-level input items, not blocks nested
        // inside one role-tagged message - so no batching wrapper is
        // needed, they just get appended in order.
        const outputItems = callsWithResults.map(({ call, result }) => ({
            type: "function_call_output",
            call_id: call.id,
            output: this._safeStringify(result)
        }));
        return { ...history, input: [...history.input, ...outputItems] };
    }

    _safeParseArgs(argsJson) {
        try {
            return JSON.parse(argsJson || "{}");
        } catch {
            return {};
        }
    }

    _safeStringify(result) {
        try {
            return JSON.stringify(result);
        } catch {
            return JSON.stringify({ success: false, message: "Tool result could not be serialized." });
        }
    }
}

module.exports = OpenAICodingProvider;
