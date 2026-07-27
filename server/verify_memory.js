const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const bootstrap = require("./bootstrap");
const Kernel = require("./core/Kernel");

async function run() {
    console.log("Bootstrapping kernel...");
    await bootstrap();

    const memoryService = Kernel.get("memoryService");
    const fileStore = Kernel.get("memoryFileStore");

    // ── Reset ────────────────────────────────────────────────────────────────
    console.log("\n--- Resetting data stores ---");
    fileStore.writeMemories([]);
    fileStore.writeProfile({
        user: { name: "Louis" },
        preferences: { likes: [], dislikes: [] },
        goals: ["Complete Yuna AI architecture refactoring"],
        projects: ["Yuna companion app"],
        relationship: { level: 1, points: 0 },
        timeline: []
    });

    // ── Test 1: Save long-term semantic memories ──────────────────────────────
    console.log("\n--- Test 1: Save Long-Term Semantic Memories ---");
    await memoryService.saveLongTermMemory(
        "Louis's favorite food is spicy chicken ramen.",
        "preference", 7
    );
    await memoryService.saveLongTermMemory(
        "Louis is building a WebGL Live2D character panel for Yuna.",
        "project", 8
    );

    const saved = fileStore.readMemories();
    console.log(`Memories stored on disk: ${saved.length}`);
    const embeddingOk = saved.length === 2 && Array.isArray(saved[0].embedding) && saved[0].embedding.length > 10;
    console.log(embeddingOk
        ? `✅ Success: ${saved.length} memories saved with ${saved[0].embedding.length}-dim embeddings!`
        : "❌ Failure: Memories were not saved correctly.");

    // ── Test 2: Semantic vector search ────────────────────────────────────────
    console.log("\n--- Test 2: Semantic Vector Search ---");

    const foodHits = await memoryService.searchSemanticMemory("What food does Louis enjoy eating?", 2);
    console.log("Food search:", foodHits.map(m => `[${m.similarity.toFixed(4)}] ${m.text}`));
    const foodOk = foodHits.length > 0 && foodHits[0].text.toLowerCase().includes("ramen");
    console.log(foodOk ? "✅ Food search matched!" : "❌ Food search failed.");

    const projectHits = await memoryService.searchSemanticMemory("What project is Louis working on?", 2);
    console.log("Project search:", projectHits.map(m => `[${m.similarity.toFixed(4)}] ${m.text}`));
    const projOk = projectHits.length > 0 && projectHits[0].text.toLowerCase().includes("live2d");
    console.log(projOk ? "✅ Project search matched!" : "❌ Project search failed.");

    // ── Test 3: Memory Retrieval Pipeline ─────────────────────────────────────
    console.log("\n--- Test 3: Memory Retrieval Pipeline ---");
    const ctx = await memoryService.retrieveContextMemories("sock-001", "What project is Louis building?");
    console.log("Profile:", ctx.userProfile);
    console.log("Relationship Level:", ctx.relationship.level);
    console.log("Goals:", ctx.goals);
    console.log("Projects:", ctx.projects);
    console.log("Relevant Memories:", ctx.relevantMemories);
    const ctxOk = ctx.relevantMemories.some(m => m.toLowerCase().includes("live2d"));
    console.log(ctxOk ? "✅ Retrieval pipeline found project memory!" : "❌ Retrieval pipeline missed it.");

    // ── Test 4: Memory Compression ────────────────────────────────────────────
    console.log("\n--- Test 4: Memory Compression (21 short-term msgs → compress) ---");
    const sid = "sock-compress";
    for (let i = 0; i < 21; i++) {
        const role = i % 2 === 0 ? "user" : "assistant";
        memoryService.addShortMemory(sid, role,
            role === "user"
                ? `Message ${i}: My hobby is photography.`
                : `Reply ${i}: That sounds wonderful!`
        );
    }
    console.log(`Before: ${memoryService.getShortMemory(sid).length} items`);
    await memoryService.compressConversation(sid);
    console.log(`After:  ${memoryService.getShortMemory(sid).length} items`);

    const prof = memoryService.getProfile();
    console.log("Relationship points:", prof.relationship?.points);
    const compressedMems = fileStore.readMemories();
    console.log(`Total long-term memories after compression: ${compressedMems.length}`);
    console.log(compressedMems.length > 2
        ? `✅ Compression extracted ${compressedMems.length - 2} new long-term memories!`
        : "⚠️  Compression ran but LLM found nothing novel to extract.");

    // ── Done ──────────────────────────────────────────────────────────────────
    console.log("\n✨ All memory verification tests completed!");
    process.exit(0);
}

run().catch(err => {
    console.error("\nFatal error:", err.message);
    process.exit(1);
});
