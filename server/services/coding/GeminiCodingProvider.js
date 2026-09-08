const CodingModelProvider = require("./CodingModelProvider");

/**
 * ==========================================
 * GeminiCodingProvider
 * ------------------------------------------
 * Adapts GeminiProvider.generateWithTools() (server/providers/GeminiProvider.js)
 * to the common CodingModelProvider interface CodingAgentRuntime expects.
 * Does not create its own GoogleGenAI client - reuses the ProviderManager's
 * already-constructed GeminiProvider instance/model/API key.
 *
 * History shape used here: a plain array of Gemini `Content` objects
 * ({role: "user"|"model", parts: [...]}), exactly what
 * generateContent()/generateWithTools() expect as `contents`. Nothing
 * outside this file needs to know that.
 * ==========================================
 */
class GeminiCodingProvider extends CodingModelProvider {
    constructor(geminiProvider) {
        super();
        this.geminiProvider = geminiProvider;
    }

    getName() {
        return "gemini";
    }

    isConfigured() {
        // GeminiProvider's constructor already throws if GEMINI_API_KEY is
        // missing, so if we have an instance at all, it's configured. This
        // stays a real check (not just "truthy instance") so a future
        // provider that DOESN'T throw at construction time still reports
        // correctly.
        return !!(this.geminiProvider && process.env.GEMINI_API_KEY);
    }

    buildInitialHistory(taskText, systemInstruction) {
        // Gemini has no dedicated system-role turn for generateContent the
        // way chat-style APIs do - the system instruction is prepended as
        // plain text in the first user turn instead.
        const text = systemInstruction ? `${systemInstruction}\n\n---\n\nTask: ${taskText}` : taskText;
        return [{ role: "user", parts: [{ text }] }];
    }

    async sendTurn(history, tools) {
        const response = await this.geminiProvider.generateWithTools(history, tools, { mode: "AUTO" });

        // Stashed on the instance so appendModelTurn() (called right after
        // sendTurn() by the runtime, same tick) can use the exact
        // candidate content Gemini returned instead of reconstructing it -
        // avoids any drift between what we read functionCalls from and
        // what we replay back as history.
        this._lastCandidateContent = response?.candidates?.[0]?.content
            || { role: "model", parts: response.text ? [{ text: response.text }] : [] };

        const functionCalls = (response.functionCalls || []).map((call, index) => ({
            // Gemini function calls don't always carry an id - synthesize
            // a stable one per turn so appendFunctionResultsTurn can match
            // it back up when there are multiple calls in one turn.
            id: call.id || `call_${index}`,
            name: call.name,
            args: call.args || {}
        }));

        return { functionCalls, text: response.text || "" };
    }

    appendModelTurn(history) {
        return [...history, this._lastCandidateContent];
    }

    appendFunctionResultsTurn(history, callsWithResults) {
        const { createPartFromFunctionResponse } = require("@google/genai");
        // Gemini expects every function response for the calls in the
        // preceding model turn batched into ONE message, not one message
        // per call.
        const parts = callsWithResults.map(({ call, result }) =>
            createPartFromFunctionResponse(call.id, call.name, result));
        return [...history, { role: "user", parts }];
    }
}

module.exports = GeminiCodingProvider;
