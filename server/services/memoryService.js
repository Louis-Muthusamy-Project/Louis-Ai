const Kernel = require("../core/Kernel");
const MemoryItem = require("../domain/MemoryItem");

/**
 * ==========================================
 * MemoryService - Upgraded Service Class
 * ------------------------------------------
 * Short-term memory (this.shortMemory) is an in-process Map
 * keyed by whatever identity the caller passes in - as of the
 * auth work, chatController passes the authenticated user's id
 * (socket.data.user.id), not socket.id, so it's naturally
 * per-user without any change needed to this Map's own logic.
 *
 * Long-term memory (profile/semantic memories) is persisted via
 * `repository`, which is now genuinely user-scoped: every method
 * below that touches the repository takes an explicit `userId`
 * and passes it straight through. That userId must always
 * originate from a verified JWT further up the call chain
 * (chatController -> AIOrchestrator -> here) - this service does
 * not and should not validate identity itself.
 * ==========================================
 */
class MemoryService {
    constructor(kernel) {
        this.kernel = kernel;
        this.shortMemory = new Map();
        this.maxShortMemory = 20;
    }

    get repository() {
        return this.kernel.get("memoryRepository");
    }

    get providerManager() {
        return this.kernel.get("providerManager");
    }

    // 1. Short-term Memory methods
    getShortMemory(userId) {
        if (!this.shortMemory.has(userId)) {
            this.shortMemory.set(userId, []);
        }
        return this.shortMemory.get(userId);
    }

    addShortMemory(userId, role, text) {
        const memory = this.getShortMemory(userId);
        memory.push({
            role,
            text,
            createdAt: new Date().toISOString()
        });

        if (memory.length > this.maxShortMemory) {
            // Trigger automatic background memory compression
            // We run it asynchronously to avoid blocking the user request
            this.compressConversation(userId).catch(err => {
                console.error("[MemoryService] Background compression failed:", err);
            });
        }
    }

    clearShortMemory(userId) {
        this.shortMemory.delete(userId);
    }

    getSummary(userId) {
        const memory = this.getShortMemory(userId);
        return memory.map(item => ({
            role: item.role,
            text: item.text
        }));
    }

    // Legacy Key-Value mock long-term methods (to support existing requirements)
    async saveLongMemory(userId, key, value) {
        const profile = await this.repository.readProfile(userId);
        if (!profile.user) profile.user = {};
        profile.user[key] = value;
        await this.repository.writeProfile(userId, profile);
    }

    async getLongMemory(userId) {
        const profile = await this.repository.readProfile(userId);
        return profile.user || {};
    }

    async removeLongMemory(userId, key) {
        const profile = await this.repository.readProfile(userId);
        if (profile.user) {
            delete profile.user[key];
            await this.repository.writeProfile(userId, profile);
        }
    }

    // 2. New Cognitive Memory System methods
    // Vector Cosine Similarity
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dotProduct = 0.0;
        let normA = 0.0;
        let normB = 0.0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    // Save Long-term Memory item
    async saveLongTermMemory(userId, text, category = "general", importance = null) {
        try {
            const embedding = await this.providerManager.embed(text);

            if (importance === null) {
                importance = await this.scoreImportance(text);
            }

            const item = new MemoryItem({
                text,
                embedding,
                importance,
                category
            });

            const memories = await this.repository.readMemories(userId);
            memories.push(item.toJSON());
            await this.repository.writeMemories(userId, memories);

            // Trigger automatic cleanup after saving
            this.cleanupMemories(userId);

            return item;
        } catch (error) {
            console.error("[MemoryService] Failed saving long-term memory:", error);
        }
    }

    // Score importance using Gemini
    async scoreImportance(text) {
        try {
            const prompt = `Analyze this memory statement and rate its importance on a scale of 1 to 10 (1 is completely trivial like greeting, 10 is a core fact about user's identity, preferences, relationships, or life goals). Respond with ONLY the number.
Memory: "${text}"`;
            const response = await this.providerManager.generate([
                { role: "user", parts: [{ text: prompt }] }
            ]);
            const score = parseInt(response.trim(), 10);
            return isNaN(score) ? 5 : Math.max(1, Math.min(10, score));
        } catch (error) {
            return 5;
        }
    }

    // Semantic Vector Search
    async searchSemanticMemory(userId, query, limit = 5, minSimilarity = 0.65) {
        try {
            const queryEmbedding = await this.providerManager.embed(query);
            const memories = await this.repository.readMemories(userId);

            const scored = memories
                .map(m => {
                    const similarity = this.cosineSimilarity(queryEmbedding, m.embedding);
                    return { ...m, similarity };
                })
                .filter(m => m.similarity >= minSimilarity)
                .sort((a, b) => b.similarity - a.similarity);

            return scored.slice(0, limit);
        } catch (error) {
            console.error("[MemoryService] Semantic search failed:", error);
            return [];
        }
    }

    // Profile & Relationship operations
    async getProfile(userId) {
        return await this.repository.readProfile(userId);
    }

    async updateProfile(userId, updates) {
        const profile = await this.repository.readProfile(userId);
        const merged = {
            ...profile,
            ...updates,
            user: { ...profile.user, ...updates.user },
            preferences: { ...profile.preferences, ...updates.preferences }
        };
        await this.repository.writeProfile(userId, merged);
        return merged;
    }

    async updateRelationship(userId, points, profile = null) {
        if (!profile) {
            profile = await this.repository.readProfile(userId);
        }
        if (!profile.relationship) {
            profile.relationship = { level: 1, points: 0, firstInteraction: new Date().toISOString() };
        }

        const rel = profile.relationship;
        rel.points += points;

        const oldLevel = rel.level;
        rel.level = Math.min(10, Math.floor(rel.points / 10) + 1);
        rel.lastInteraction = new Date().toISOString();
        rel.interactionCount = (rel.interactionCount || 0) + 1;

        if (rel.level > oldLevel) {
            if (!profile.timeline) profile.timeline = [];
            profile.timeline.push({
                event: `Leveled up relationship with Yuna to Level ${rel.level}!`,
                timestamp: new Date().toISOString()
            });
        }

        await this.repository.writeProfile(userId, profile);
        return rel;
    }

    // Memory Retrieval Pipeline
    async retrieveContextMemories(userId, userMessage) {
        const profile = await this.repository.readProfile(userId);

        // Find relevant long-term memories via semantic vector search
        const semanticResults = await this.searchSemanticMemory(userId, userMessage, 4);
        const relevantMemories = semanticResults.map(m => `Category [${m.category}]: ${m.text}`);

        await this.updateRelationship(userId, 1, JSON.parse(JSON.stringify(profile)));

        return {
            relevantMemories,
            userProfile: profile.user || {},
            preferences: profile.preferences || {},
            relationship: profile.relationship || {},
            timeline: profile.timeline || [],
            goals: profile.goals || [],
            projects: profile.projects || []
        };
    }

    // Memory Compression Pipeline (Background summary of chat)
    async compressConversation(userId) {
        const history = this.getShortMemory(userId);
        if (history.length < this.maxShortMemory) return;

        console.log(`[MemoryService] Running conversation compression pipeline for user: ${userId}`);

        // Extract last 16 messages for compression
        const targetMessages = history.slice(0, 16);
        const remainingMessages = history.slice(16);

        const conversationText = targetMessages
            .map(m => `${m.role === "user" ? "User" : "Yuna"}: ${m.text}`)
            .join("\n");

        try {
            const systemPrompt = `You are Yuna's Memory Processor. Read this conversation transcript and extract:
1. Long-term semantic facts (new user details, preferences, projects, goals, likes, dislikes, relationship updates).
2. Updates to the user profile.
3. Relationship score points (increase by 1 to 5 if user showed high trust/intimacy, decrease by 1 to 5 if user was hostile).

Provide the output ONLY as a JSON block matching this schema:
{
  "newMemories": [{"text": string, "category": string, "importance": number}],
  "profileUpdates": {
     "user": {"name": string, "birthday": string | null, "hobbies": string[], "job": string | null},
     "preferences": {"likes": string[], "dislikes": string[], "topicsOfInterest": string[]}
  },
  "relationshipPoints": number
}

No markdown. No code blocks. Respond with JSON only.`;

            const contents = [
                {
                    role: "user",
                    parts: [{ text: `${systemPrompt}\n\nTranscript:\n${conversationText}` }]
                }
            ];

            const reply = await this.providerManager.generate(contents);

            let jsonText = reply.trim();
            if (jsonText.startsWith("```json")) {
                jsonText = jsonText.replace(/^```json/, "").replace(/```$/, "").trim();
            } else if (jsonText.startsWith("```")) {
                jsonText = jsonText.replace(/^```/, "").replace(/```$/, "").trim();
            }

            const parsed = JSON.parse(jsonText);

            // 1. Save new semantic memories
            if (parsed.newMemories && Array.isArray(parsed.newMemories)) {
                for (const mem of parsed.newMemories) {
                    await this.saveLongTermMemory(userId, mem.text, mem.category || "general", mem.importance || 5);
                }
            }

            // 2. Update user profile details
            if (parsed.profileUpdates) {
                await this.updateProfile(userId, parsed.profileUpdates);
            }

            // 3. Update relationship points
            if (parsed.relationshipPoints) {
                await this.updateRelationship(userId, parsed.relationshipPoints);
            }

            // 4. Update the short term memory log to keep only remaining messages
            this.shortMemory.set(userId, remainingMessages);

            console.log("[MemoryService] Conversation compression pipeline completed successfully!");
        } catch (error) {
            console.error("[MemoryService] Failed to compress conversation:", error);
        }
    }

    // Memory Cleanup (De-duplication of long-term entries)
    async cleanupMemories(userId) {
        try {
            const memories = await this.repository.readMemories(userId);
            if (memories.length < 2) return;

            const uniqueMemories = [];

            for (const item of memories) {
                let duplicate = false;
                for (const existing of uniqueMemories) {
                    const similarity = this.cosineSimilarity(item.embedding, existing.embedding);
                    // If similarity is extremely high (> 0.9), merge or discard duplicate
                    if (similarity > 0.9) {
                        duplicate = true;
                        // Keep the one with higher importance
                        if (item.importance > existing.importance) {
                            existing.text = item.text;
                            existing.importance = item.importance;
                            existing.embedding = item.embedding;
                            existing.category = item.category;
                            existing.updatedAt = new Date().toISOString();
                        }
                        break;
                    }
                }
                if (!duplicate) {
                    uniqueMemories.push(item);
                }
            }

            if (uniqueMemories.length !== memories.length) {
                console.log(`[MemoryService] Cleaned up ${memories.length - uniqueMemories.length} duplicate long-term memories.`);
                await this.repository.writeMemories(userId, uniqueMemories);
            }
        } catch (error) {
            console.error("[MemoryService] Memory cleanup failed:", error);
        }
    }
}

// Wrapper object referencing Kernel's DI instance
const wrapper = {
    getShortMemory: (u) => Kernel.get("memoryService").getShortMemory(u),
    addShortMemory: (u, r, t) => Kernel.get("memoryService").addShortMemory(u, r, t),
    clearShortMemory: (u) => Kernel.get("memoryService").clearShortMemory(u),
    saveLongMemory: (u, k, v) => Kernel.get("memoryService").saveLongMemory(u, k, v),
    getLongMemory: (u) => Kernel.get("memoryService").getLongMemory(u),
    removeLongMemory: (u, k) => Kernel.get("memoryService").removeLongMemory(u, k),
    getSummary: (u) => Kernel.get("memoryService").getSummary(u)
};

module.exports = Object.assign(wrapper, { MemoryService });