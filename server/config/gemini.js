/**
 * ==========================================
 * Gemini Configuration
 * ==========================================
 */

module.exports = {

    provider: "gemini",

    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",

    generationConfig: {

        temperature: 0.8,

        topP: 0.95,

        topK: 40,

        maxOutputTokens: 2048,

        candidateCount: 1

    },

    safetySettings: [

        {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_ONLY_HIGH"
        },

        {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_ONLY_HIGH"
        },

        {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_ONLY_HIGH"
        },

        {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_ONLY_HIGH"
        }

    ],

    retry: {

        maxAttempts: 3,

        retryDelay: 1000

    },

    timeout: 30000

};