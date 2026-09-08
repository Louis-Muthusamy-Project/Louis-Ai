/**
 * ==========================================
 * OpenAI Configuration (Coding Agent only)
 * ------------------------------------------
 * Yuna's general Chat/Character features do not use OpenAI - this config
 * exists solely for the Coding panel's OpenAI provider option. Model name
 * is env-configurable so it can be updated as OpenAI's model naming
 * changes without a code change (see GeminiConfig for the same pattern).
 * ==========================================
 */

module.exports = {

    provider: "openai",

    model: process.env.OPENAI_CODING_MODEL || "gpt-5.1",

    maxOutputTokens: Number(process.env.OPENAI_CODING_MAX_TOKENS) || 4096,

    timeout: 60000

};
