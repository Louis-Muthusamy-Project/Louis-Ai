/**
 * ==========================================
 * AIOrchestrator - Main AI Business Service
 * ==========================================
 */
const RetrySystem = require("../utils/retrySystem");
const FallbackSystem = require("../utils/fallbackSystem");

class AIOrchestrator {
    constructor(kernel) {
        this.kernel = kernel;
        this.providerManager = kernel.get("providerManager");
        this.promptBuilder = kernel.get("promptBuilder");
        this.emotionService = kernel.get("emotionService");
        this.emotionEngine = kernel.get("emotionEngine");
        this.memoryService = kernel.get("memoryService");
        this.contextService = kernel.get("contextService");
        this.voiceService = kernel.get("voiceService");
        this.conversationService = kernel.get("conversationService");
        this.streamService = kernel.get("streamService");
        this.stateMachine = kernel.get("stateMachine");
        this.intentDetector = kernel.get("intentDetector");
        this.taskPlanner = kernel.get("taskPlanner");
        this.toolRouter = kernel.get("toolRouter");
    }

    async generateReply(socketId, userMessage) {
        if (!userMessage || !userMessage.trim()) {
            throw new Error("User message is empty.");
        }

        try {
            // 1. Transition State to Thinking
            if (this.stateMachine) {
                this.stateMachine.transitionTo("thinking");
            }

            // 2. Log User message in Session
            this.conversationService.addUserMessage(socketId, userMessage);
            this.memoryService.addShortMemory(socketId, "user", userMessage);

            // 3. Run Intent Detection
            const intentResult = await this.intentDetector.detect(userMessage);

            // 4. Run Task Planning & Tool Routing
            const plan = this.taskPlanner.plan(intentResult);
            const toolResults = await this.toolRouter.route(plan);

            // 5. Context Building
            const cognitiveMemory = await this.memoryService.retrieveContextMemories(socketId, userMessage);
            const currentEmotion = this.stateMachine ? this.stateMachine.currentEmotion : "neutral";
            const preReplyEmotionState = this.emotionEngine.analyzeText(socketId, userMessage, intentResult.intent);
            const context = this.contextService.build(socketId, {
                emotion: currentEmotion,
                emotionState: preReplyEmotionState.toSummary(),
                userMessage,
                toolResults,
                intent: intentResult.intent,
                userProfile: cognitiveMemory.userProfile,
                memory: cognitiveMemory.relevantMemories,
                relationship: cognitiveMemory.relationship,
                timeline: cognitiveMemory.timeline,
                goals: cognitiveMemory.goals,
                projects: cognitiveMemory.projects
            });

            // 6. Compile Prompt using Prompt Builder v2
            const prompt = this.promptBuilder.build(context);
            const contents = [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ];

            // 7. Run generation with Retry System
            const reply = await RetrySystem.execute(async () => {
                return await this.providerManager.generate(contents);
            }, {
                maxAttempts: 3,
                delay: 1000
            });

            // 8. Log Assistant response
            this.conversationService.addAssistantMessage(socketId, reply);
            this.memoryService.addShortMemory(socketId, "assistant", reply);

            // 9. Cognitive Emotion Analysis (text + intent → full state update)
            const emotionState = this.emotionEngine.analyzeText(socketId, reply, intentResult.intent);
            const emotion = emotionState.toPrimaryEmotion();
            if (this.stateMachine) {
                this.stateMachine.setEmotion(emotion);
            }

            // 10. Queue voice audio synthesis
            try {
                this.voiceService.enqueue(reply);
            } catch (error) {
                console.error("[AIOrchestrator] Voice Queue Error:", error);
            }

            return {
                success: true,
                text: reply,
                emotion,
                emotionState: emotionState.toSummary(),
                animation: this.emotionService.getAnimation(emotion),
                voiceTone: this.emotionService.getVoiceTone(emotion),
                createdAt: new Date().toISOString()
            };

        } catch (error) {
            console.error("[AIOrchestrator] Pipeline failure:", error);
            if (this.stateMachine) {
                this.stateMachine.transitionTo("idle");
            }
            // Fallback system response
            return FallbackSystem.getFallbackResponse(error);
        }
    }

    async streamReply(socketId, userMessage, callbacks = {}) {
        if (!userMessage || !userMessage.trim()) {
            throw new Error("User message is empty.");
        }

        const {
            onStart,
            onChunk,
            onComplete,
            onError
        } = callbacks;

        try {
            // 1. Transition State to Thinking
            if (this.stateMachine) {
                this.stateMachine.transitionTo("thinking");
            }

            // 2. Log User message in Session
            this.conversationService.addUserMessage(socketId, userMessage);
            this.memoryService.addShortMemory(socketId, "user", userMessage);

            // 3. Run Intent Detection
            const intentResult = await this.intentDetector.detect(userMessage);

            // 4. Run Task Planning & Tool Routing
            const plan = this.taskPlanner.plan(intentResult);
            const toolResults = await this.toolRouter.route(plan);

            // 5. Context Building
            const cognitiveMemory = await this.memoryService.retrieveContextMemories(socketId, userMessage);
            const currentEmotion = this.stateMachine ? this.stateMachine.currentEmotion : "neutral";
            const context = this.contextService.build(socketId, {
                emotion: currentEmotion,
                userMessage,
                toolResults,
                intent: intentResult.intent,
                userProfile: cognitiveMemory.userProfile,
                memory: cognitiveMemory.relevantMemories,
                relationship: cognitiveMemory.relationship,
                timeline: cognitiveMemory.timeline,
                goals: cognitiveMemory.goals,
                projects: cognitiveMemory.projects
            });

            // 6. Compile Prompt using Prompt Builder v2
            const prompt = this.promptBuilder.build(context);
            const contents = [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ];

            // 7. Execute Native Streaming with Retry System
            let streamResultText = "";

            await RetrySystem.execute(async () => {
                streamResultText = await this.providerManager.stream(contents, {
                    onStart: async () => {
                        if (typeof onStart === "function") await onStart();
                    },
                    onChunk: async (chunkData) => {
                        if (typeof onChunk === "function") await onChunk(chunkData);
                    },
                    onComplete: async (completeData) => {
                        const text = completeData.text;
                        
                        // Log assistant response
                        this.conversationService.addAssistantMessage(socketId, text);
                        this.memoryService.addShortMemory(socketId, "assistant", text);

                        // Cognitive Emotion Analysis
                        const emotionState = this.emotionEngine.analyzeText(socketId, text, intentResult.intent);
                        const emotion = emotionState.toPrimaryEmotion();
                        if (this.stateMachine) {
                            this.stateMachine.setEmotion(emotion);
                        }

                        // Queue voice audio synthesis
                        try {
                            this.voiceService.enqueue(text);
                        } catch (vErr) {
                            console.error("[AIOrchestrator] Voice Queue Error:", vErr);
                        }

                        if (typeof onComplete === "function") {
                            await onComplete({
                                success: true,
                                text,
                                emotion,
                                emotionState: emotionState.toSummary(),
                                animation: this.emotionService.getAnimation(emotion),
                                voiceTone: this.emotionService.getVoiceTone(emotion),
                                createdAt: new Date().toISOString()
                            });
                        }
                    },
                    onError: async (err) => {
                        throw err; // propagates to retry logic
                    }
                });
            }, {
                maxAttempts: 3,
                delay: 1000
            });

            const finalState = this.emotionEngine.getState(socketId);
            const finalEmotion = finalState.toPrimaryEmotion();
            return {
                success: true,
                text: streamResultText,
                emotion: finalEmotion,
                emotionState: finalState.toSummary(),
                animation: this.emotionService.getAnimation(finalEmotion),
                voiceTone: this.emotionService.getVoiceTone(finalEmotion),
                createdAt: new Date().toISOString()
            };

        } catch (error) {
            console.error("[AIOrchestrator] Streaming pipeline failure:", error);
            if (this.stateMachine) {
                this.stateMachine.transitionTo("idle");
            }

            const fallback = FallbackSystem.getFallbackResponse(error);
            
            if (typeof onError === "function") {
                await onError(error);
            }

            if (typeof onComplete === "function") {
                await onComplete(fallback);
            }

            return fallback;
        }
    }
}

module.exports = { AIOrchestrator };
