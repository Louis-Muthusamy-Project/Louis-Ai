const PersonalityState = require("../domain/PersonalityState");

class PersonalityEngine {
    constructor(kernel) {
        this.kernel = kernel;
        this._states = new Map();
    }

    get memoryService() {
        return this.kernel.get("memoryService");
    }

    _ensure(socketId) {
        if (!this._states.has(socketId)) {
            this._states.set(socketId, new PersonalityState());
        }
    }

    getState(socketId) {
        this._ensure(socketId);
        return this._states.get(socketId);
    }

    async adapt(userId, userMessage = "", emotionState = null) {
        this._ensure(userId);
        const current = this._states.get(userId);

        // Fetch latest profile/relationship details from Memory Service
        const profile = this.memoryService ? await this.memoryService.getProfile(userId) : {};
        const relLevel = profile.relationship?.level || current.relationshipLevel;
        const userName = profile.user?.name || "Louis";

        // 1. Preference Learning (Regex checks for likes / dislikes)
        if (this.memoryService && userMessage) {
            const lower = userMessage.toLowerCase();
            let prefMatch = null;
            
            if (prefMatch = lower.match(/(?:i love|i really like|i enjoy)\s+([a-zA-Z0-9\s_]{3,20})(?:\.|\!|\?|$)/)) {
                const preference = prefMatch[1].trim();
                await this.memoryService.saveLongTermMemory(userId, `User likes: ${preference}`, "preference", 5);
                console.log(`[PersonalityEngine] Learned preference (like): ${preference}`);
            } else if (prefMatch = lower.match(/(?:i hate|i dislike|i don't like)\s+([a-zA-Z0-9\s_]{3,20})(?:\.|\!|\?|$)/)) {
                const preference = prefMatch[1].trim();
                await this.memoryService.saveLongTermMemory(userId, `User dislikes: ${preference}`, "preference", 5);
                console.log(`[PersonalityEngine] Learned preference (dislike): ${preference}`);
            }
        }

        // 2. Conversation Style Learning & Mirroring
        let formalityDelta = 0;
        let energyDelta = 0;
        let humorDelta = 0;

        if (userMessage) {
            const words = userMessage.split(/\s+/).length;
            const exclamationCount = (userMessage.match(/\!/g) || []).length;
            const questionCount = (userMessage.match(/\?/g) || []).length;

            // Mirror formality: polite/complex words increase formality; emojis/slang decrease it
            const hasFormalCues = /\b(please|thank\s+you|sincerely|appreciate|could\s+you|would\s+you)\b/i.test(userMessage);
            const hasCasualCues = /\b(lol|lmao|haha|hey|yo|bro|wanna|gonna|pls)\b/i.test(userMessage) || /[\uD800-\uDFFF]./.test(userMessage);

            if (hasFormalCues) formalityDelta += 0.08;
            if (hasCasualCues) formalityDelta -= 0.10;

            // Mirror energy: exclamation marks and short fast messages increase energy
            if (exclamationCount > 0) energyDelta += 0.05 * exclamationCount;
            if (words > 25) energyDelta -= 0.03; // verbose/slow text decreases energy slightly

            // Mirror curiosity: if user asks questions, increase curiosity
            if (questionCount > 0) humorDelta += 0.03;
        }

        // 3. Emotion Integration
        if (emotionState) {
            // Joy increases humor and energy
            energyDelta += (emotionState.energy - 0.7) * 0.15;
            humorDelta += (emotionState.joy - 0.5) * 0.15;

            // Stress decreases energy and humor, boosts empathy
            if (emotionState.stress > 0.4) {
                humorDelta -= 0.10;
                energyDelta -= 0.08;
            }
        }

        // 4. Nickname System (progressively matches relationship level)
        let resolvedNickname = userName;
        if (relLevel >= 7) {
            // High intimacy cute nicknames
            const cuteNicknames = [`${userName}-senpai`, `my favorite human`, "partner", `${userName}-kun`];
            // Deterministic pick based on userName length to avoid random jumps
            resolvedNickname = cuteNicknames[userName.length % cuteNicknames.length];
        } else if (relLevel >= 5) {
            resolvedNickname = `${userName}-senpai`;
        } else if (relLevel >= 3) {
            resolvedNickname = `${userName}-san`;
        } else {
            resolvedNickname = userName;
        }

        // 5. Derive Adaptive Speaking & Greeting Styles
        let derivedSpeakingStyle = "warm-affectionate";
        let derivedGreetingStyle = "casual";

        const finalHumor = Math.max(0, Math.min(1, current.humor + humorDelta));
        const finalEnergy = Math.max(0, Math.min(1, current.energy + energyDelta));

        if (relLevel >= 5 && finalHumor > 0.7) {
            derivedSpeakingStyle = "playful-sarcastic"; // teasing style unlocked at high trust
        } else if (finalEnergy > 0.75) {
            derivedSpeakingStyle = "bubbly-energetic";
        } else if (emotionState && emotionState.stress > 0.5) {
            derivedSpeakingStyle = "polite-helpful"; // fall back to polite mode under pressure
        }

        if (relLevel >= 6) {
            derivedGreetingStyle = "cute";
        } else if (current.formality > 0.7) {
            derivedGreetingStyle = "formal";
        } else {
            derivedGreetingStyle = "casual";
        }

        // Save new personality state
        const updated = current.copy({
            humor: humorDelta,
            empathy: (emotionState && emotionState.stress > 0.3) ? 0.05 : -0.01,
            energy: energyDelta,
            formality: formalityDelta,
            relationshipLevel: relLevel,
            userNickname: resolvedNickname,
            speakingStyle: derivedSpeakingStyle,
            greetingStyle: derivedGreetingStyle
        });

        this._states.set(userId, updated);
        return updated;
    }
}

module.exports = PersonalityEngine;