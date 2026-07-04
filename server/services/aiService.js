const ProviderManager = require("../providers/ProviderManager");
const PromptBuilder = require("./promptBuilder");
const EmotionService = require("./emotionService");
const StreamService = require("./streamService");
const MemoryService = require("./memoryService");
const ContextService = require("./contextService");
const VoiceService = require("./voiceService");

const {
    addUserMessage,
    addAssistantMessage
} = require("./conversationService");

class AIService {

    async generateReply(socketId, userMessage) {

        if (!userMessage || !userMessage.trim()) {
            throw new Error("User message is empty.");
        }

        // Save user message
        addUserMessage(socketId, userMessage);

        MemoryService.addShortMemory(
            socketId,
            "user",
            userMessage
        );

        // Load conversation history
        const context = ContextService.build(socketId, {

            emotion: "happy",

            userMessage

        });

        const prompt = PromptBuilder.build(context);

        const contents = [

            {

                role: "user",

                parts: [

                    {

                        text: prompt

                    }

                ]

            }

        ];

        // Ask provider
        const reply = await ProviderManager.generate(contents);

        // Save assistant reply
        addAssistantMessage(socketId, reply);

        MemoryService.addShortMemory(
            socketId,
            "assistant",
            reply
        );

        const emotion = EmotionService.detect(reply);

        // Add reply to voice queue
        try {

            VoiceService.enqueue(reply);

        }
        catch (error) {

            console.error("Voice Queue:", error);

        }

        return {
            success: true,
            text: reply,
            emotion,
            animation: EmotionService.getAnimation(emotion),
            voiceTone: EmotionService.getVoiceTone(emotion),
            createdAt: new Date().toISOString()
        };
    }
    async streamReply(socketId, userMessage, callbacks = {}) {

        const result = await this.generateReply(
            socketId,
            userMessage
        );

        await StreamService.stream(
            result.text,
            callbacks
        );

        return result;

    }

}

module.exports = new AIService();