/**
 * ==========================================
 * Yuna Fallback System
 * ------------------------------------------
 * Handles fallback responses and payloads in case
 * of AI service failures.
 * ==========================================
 */
class FallbackSystem {
    /**
     * Generates a natural, styled fallback response payload when the AI provider fails.
     * @param {Error} error The underlying error
     */
    static getFallbackResponse(error) {
        const fallbackMessages = [
            "I'm having a brief connection issue right now, but I'm still here. Could you try sending that again?",
            "Hmm, my thoughts got a bit tangled up. Let's try that again in a moment!",
            "I'm experiencing a quick hiccup with my AI engine. Don't worry, I'll be back in just a second!"
        ];
        
        const randomIndex = Math.floor(Math.random() * fallbackMessages.length);
        const text = fallbackMessages[randomIndex];
        
        return {
            success: false,
            isFallback: true,
            text,
            emotion: "confused",
            animation: "confused",
            voiceTone: "soft",
            error: error ? error.message : "AI generation failure",
            createdAt: new Date().toISOString()
        };
    }
}

module.exports = FallbackSystem;
