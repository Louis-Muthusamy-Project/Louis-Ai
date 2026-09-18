const VisionMemory = require('../models/VisionMemory');
const Kernel = require('../core/Kernel');

class VisionService {
    constructor() {
        this.modelName = "gemini-2.5-flash"; // Using flash for speed in vision tasks
    }

    get providerManager() {
        return Kernel.get('providerManager');
    }

    /**
     * Process an image (base64) using Gemini and store the result in memory.
     * Resolves THIS user's own configured Gemini credential per-request (see
     * ProviderManager.resolveForUser) - never a module-level client built
     * from process.env.GEMINI_API_KEY, so vision genuinely honors per-user
     * Settings keys and per-user isolation like every other AI call path.
     * @param {string} userId - Authenticated owner of this analysis (never trust a client-supplied id here).
     * @param {string} base64Image - The image data (e.g. data:image/jpeg;base64,...)
     * @param {string} source - 'camera', 'screen', etc.
     */
    async processImage(userId, base64Image, source = 'screen') {
        if (!userId) {
            throw new Error("processImage requires an authenticated userId.");
        }
        try {
            const geminiProvider = await this.providerManager.resolveForUser(userId, "gemini", "vision");

            // Remove the data URL prefix if present
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

            const prompt = `Analyze this image. 
            1. Describe the scene or main contents briefly.
            2. If there is text, provide a short summary of it (OCR).
            3. List key objects or elements you see.
            Format your response as JSON with keys: description, ocrSummary, objects.`;

            const response = await geminiProvider.client.models.generateContent({
                model: geminiProvider.model,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: base64Data
                                }
                            }
                        ]
                    }
                ]
            });

            let result;
            try {
                const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                result = JSON.parse(text);
            } catch (e) {
                console.error("Failed to parse vision JSON from Gemini:", e);
                result = { description: response.text(), ocrSummary: "", objects: [] };
            }

            // Save to memory, scoped to the owning user
            const memory = new VisionMemory({
                userId,
                source,
                description: result.description || '',
                ocrText: result.ocrSummary || '',
                detectedObjects: result.objects || []
            });
            await memory.save();

            return memory;
        } catch (error) {
            console.error("Error in VisionService processImage:", error);
            throw error;
        }
    }

    /**
     * @param {string} userId - Authenticated owner; results are always filtered to this user.
     * @param {number} limit
     */
    async getRecentContext(userId, limit = 5) {
        if (!userId) {
            throw new Error("getRecentContext requires an authenticated userId.");
        }
        return await VisionMemory.find({ userId }).sort({ timestamp: -1 }).limit(limit);
    }
}

module.exports = new VisionService();
