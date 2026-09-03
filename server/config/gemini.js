/**
 * ==========================================
 * Gemini Configuration
 * ==========================================
 */

module.exports = {

    provider: "gemini",

    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",

    // Image-generation-capable Gemini model. Configurable via env so it
    // can be updated as Google's model naming changes without a code
    // change. See GeminiProvider.generateImage() - uses generateContent
    // with responseModalities:["TEXT","IMAGE"], the same call shape as
    // normal text generation, just against an image-capable model.
    imageModel: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",

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