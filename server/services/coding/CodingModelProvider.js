/**
 * ==========================================
 * CodingModelProvider (interface)
 * ------------------------------------------
 * CodingAgentRuntime talks to whichever provider the user selected
 * (Gemini/OpenAI/Claude) ONLY through this shape. No provider-specific
 * branching belongs in the runtime - see CODING_PROVIDER_STATUS below for
 * how each provider is exposed with a uniform enabled/disabled state
 * based on whether its API key is configured.
 *
 * A concrete provider must implement:
 *
 *   getName(): string
 *   isConfigured(): boolean
 *       Whether this provider's API key is present - the runtime and the
 *       UI both use this before allowing selection/execution.
 *   async sendTurn(history, tools): Promise<{
 *       functionCalls: Array<{ id: string, name: string, args: object }>,
 *       text: string                 // any accompanying/final text from the model
 *   }>
 *   appendModelTurn(history, sendTurnResult): any[]
 *       Returns a NEW history array with the model's own turn (the one
 *       that produced sendTurnResult) appended - kept as a method rather
 *       than something CodingAgentRuntime builds itself, since only the
 *       adapter knows its provider's native turn shape.
 *   appendFunctionResultsTurn(history, callsWithResults): any[]
 *       Returns a NEW history array with ONE additional turn representing
 *       the results of every tool call from the immediately preceding
 *       model turn. This matters because some providers (Gemini included)
 *       expect all function responses for one turn's calls batched into a
 *       single message, not one message per call - so batching is the
 *       adapter's job, never the runtime's.
 *       `callsWithResults` is `Array<{ call: {id,name,args}, result: object }>`.
 *
 * `history` is an opaque, provider-native array that CodingAgentRuntime
 * only ever appends to (via the two methods above) and passes back in -
 * it never inspects or mutates history's internal shape itself, which is
 * what keeps the runtime provider-agnostic.
 * ==========================================
 */
class CodingModelProvider {
    getName() { throw new Error("getName() not implemented"); }
    isConfigured() { throw new Error("isConfigured() not implemented"); }
    async sendTurn() { throw new Error("sendTurn() not implemented"); }
    appendModelTurn() { throw new Error("appendModelTurn() not implemented"); }
    appendFunctionResultsTurn() { throw new Error("appendFunctionResultsTurn() not implemented"); }
    /** Builds the very first history array from the user's task text. */
    buildInitialHistory() { throw new Error("buildInitialHistory() not implemented"); }
}

module.exports = CodingModelProvider;
