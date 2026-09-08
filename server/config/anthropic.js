/**
 * ==========================================
 * Anthropic (Claude) Configuration (Coding Agent only)
 * ------------------------------------------
 * Yuna's general Chat/Character features do not use Claude - this config
 * exists solely for the Coding panel's Claude provider option.
 * ==========================================
 */

module.exports = {

    provider: "claude",

    model: process.env.ANTHROPIC_CODING_MODEL || "claude-sonnet-4-5",

    maxOutputTokens: Number(process.env.ANTHROPIC_CODING_MAX_TOKENS) || 4096,

    timeout: 60000

};
