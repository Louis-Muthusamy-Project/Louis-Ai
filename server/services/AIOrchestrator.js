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
        this.emotionEngine = kernel.get("emotionEngine");
        this.memoryService = kernel.get("memoryService");
        this.contextService = kernel.get("contextService");
        this.voiceService = kernel.get("voiceService");
        this.conversationService = kernel.get("conversationService");
        this.streamService = kernel.get("streamService");
        this.stateMachine = kernel.get("stateMachine");
        this.intentDetector = kernel.get("intentDetector");
        this.agentCoordinator = kernel.get("agentCoordinator");
        this.personalityEngine = kernel.get("personalityEngine");
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

            // 4. Context Building
            const cognitiveMemory = await this.memoryService.retrieveContextMemories(socketId, userMessage);
            const currentEmotion = this.stateMachine ? this.stateMachine.currentEmotion : "neutral";
            const preReplyEmotionState = this.emotionEngine.analyzeText(socketId, userMessage, intentResult.intent);
            const personalityState = await this.personalityEngine.adapt(socketId, userMessage, preReplyEmotionState);
            const context = this.contextService.build(socketId, {
                emotion: currentEmotion,
                emotionState: preReplyEmotionState.toSummary(),
                personalityDirectives: personalityState.getDirectives(),
                userMessage,
                toolResults: [],
                intent: intentResult.intent,
                userProfile: cognitiveMemory.userProfile,
                memory: cognitiveMemory.relevantMemories,
                relationship: cognitiveMemory.relationship,
                timeline: cognitiveMemory.timeline,
                goals: cognitiveMemory.goals,
                projects: cognitiveMemory.projects
            });

            // 5. Run Task Planning & Execution via Agents
            let toolResults = [];
            if (intentResult.requiresTool) {
                const coordinatorResponse = await this.agentCoordinator.handleUserMessage(socketId, userMessage, context, intentResult);
                
                // Response Processor: Gracefully format the execution results
                if (coordinatorResponse.type === "partial_failure") {
                    toolResults = [{ result: `Task partially failed. Completed: ${coordinatorResponse.completedSteps.length} steps. Failed on: ${coordinatorResponse.failedStep.capability} with error: ${coordinatorResponse.failedStep.error}` }];
                } else if (coordinatorResponse.type === "success") {
                    toolResults = [{ result: coordinatorResponse.message }];
                }
                
                // Re-inject the tool results into the context for prompt building
                context.toolResults = toolResults;
            }

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
                delay: 1000,
                timeoutMs: 30000
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
                animation: this.emotionEngine.getAnimation(emotion),
                voiceTone: this.emotionEngine.getVoiceTone(emotion),
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

            // 4. Context Building
            const cognitiveMemory = await this.memoryService.retrieveContextMemories(socketId, userMessage);
            const currentEmotion = this.stateMachine ? this.stateMachine.currentEmotion : "neutral";
            const preReplyEmotionState = this.emotionEngine.analyzeText(socketId, userMessage, intentResult.intent);
            const personalityState = await this.personalityEngine.adapt(socketId, userMessage, preReplyEmotionState);
            const context = this.contextService.build(socketId, {
                emotion: currentEmotion,
                emotionState: preReplyEmotionState.toSummary(),
                personalityDirectives: personalityState.getDirectives(),
                userMessage,
                toolResults: [],
                intent: intentResult.intent,
                userProfile: cognitiveMemory.userProfile,
                memory: cognitiveMemory.relevantMemories,
                relationship: cognitiveMemory.relationship,
                timeline: cognitiveMemory.timeline,
                goals: cognitiveMemory.goals,
                projects: cognitiveMemory.projects
            });

            // 5. Run Task Planning & Execution via Agents
            let toolResults = [];
            if (intentResult.requiresTool) {
                const coordinatorResponse = await this.agentCoordinator.handleUserMessage(socketId, userMessage, context, intentResult);
                
                if (coordinatorResponse.type === "partial_failure") {
                    toolResults = [{ result: `Task partially failed. Completed: ${coordinatorResponse.completedSteps.length} steps. Failed on: ${coordinatorResponse.failedStep.capability} with error: ${coordinatorResponse.failedStep.error}` }];
                } else if (coordinatorResponse.type === "success") {
                    toolResults = [{ result: coordinatorResponse.message }];
                }
                
                context.toolResults = toolResults;
            }

            // 6. Compile Prompt using Prompt Builder v2
            const prompt = this.promptBuilder.build(context);
            const contents = [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ];

            let streamResultText = "";
            let hasStreamedAnyChunk = false;

            const maxAttempts = 3;
            const baseDelay = 1000;
            const backoffFactor = 2;
            const timeoutMs = 30000;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const streamPromise = this.providerManager.stream(contents, {
                        onStart: async () => {
                            if (typeof onStart === "function") await onStart();
                        },
                        onChunk: async (chunkData) => {
                            hasStreamedAnyChunk = true;
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
                                    animation: this.emotionEngine.getAnimation(emotion),
                                    voiceTone: this.emotionEngine.getVoiceTone(emotion),
                                    createdAt: new Date().toISOString()
                                });
                            }
                        },
                        onError: async (err) => {
                            throw err; // propagates to the catch below
                        }
                    });

                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
                    });

                    streamResultText = await Promise.race([streamPromise, timeoutPromise]);
                    break; // success
                } catch (error) {
                    if (hasStreamedAnyChunk || attempt >= maxAttempts) {
                        throw error;
                    }
                    const backoffDelay = baseDelay * Math.pow(backoffFactor, attempt - 1);
                    console.warn(`[AIOrchestrator] Stream attempt ${attempt} failed before any chunk was sent. Retrying in ${backoffDelay}ms... Error: ${error.message}`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                }
            }

            const finalState = this.emotionEngine.getState(socketId);
            const finalEmotion = finalState.toPrimaryEmotion();
            return {
                success: true,
                text: streamResultText,
                emotion: finalEmotion,
                emotionState: finalState.toSummary(),
                animation: this.emotionEngine.getAnimation(finalEmotion),
                voiceTone: this.emotionEngine.getVoiceTone(finalEmotion),
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