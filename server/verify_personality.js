const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const PersonalityState = require("./domain/PersonalityState");
const bootstrap = require("./bootstrap");
const Kernel = require("./core/Kernel");

function assert(condition, label) {
    const mark = condition ? "✅" : "❌";
    console.log(`${mark} ${label}`);
    if (!condition) process.exitCode = 1;
}

async function run() {
    console.log("=== Personality Engine Verification ===\n");

    // ── Test 1: PersonalityState creation & clamping ──────────────────────
    console.log("--- Test 1: PersonalityState axes & clamping ---");
    const state = new PersonalityState({ humor: 1.5, empathy: -0.5 });
    assert(state.humor === 1.0,   "humor clamped to 1.0");
    assert(state.empathy === 0.0, "empathy clamped to 0.0");
    assert(state.userNickname === "friend", "nickname defaults to friend");

    // ── Test 2: Copy and copy value changes ───────────────────────────────
    console.log("\n--- Test 2: Copied traits ---");
    const copied = state.copy({ humor: -0.2, userNickname: "buddy" });
    assert(copied.humor === 0.8, "humor copy matches delta calculation");
    assert(copied.userNickname === "buddy", "nickname updated in copy");

    // ── Test 3: System Directives ─────────────────────────────────────────
    console.log("\n--- Test 3: Directives Generation ---");
    const directives = new PersonalityState({
        userNickname: "Louis-senpai",
        speakingStyle: "bubbly-energetic",
        humor: 0.8,
        formality: 0.1
    }).getDirectives();
    assert(directives.includes("Louis-senpai"), "directives contain nickname");
    assert(directives.includes("High energy"), "directives contain bubbly-energetic style");
    assert(directives.includes("Highly casual"), "directives contain casual cues");
    assert(directives.includes("Humor: Include puns"), "directives include humor guideline");

    // ── Test 4: Bootstrapping Kernel & Services ───────────────────────────
    console.log("\n--- Test 4: Kernel Resolution ---");
    await bootstrap();
    const personalityEngine = Kernel.get("personalityEngine");
    const memoryService = Kernel.get("memoryService");
    const emotionEngine = Kernel.get("emotionEngine");
    assert(!!personalityEngine, "personalityEngine resolves from Kernel");

    // Reset Memory profile for deterministic test values
    const fileStore = Kernel.get("memoryFileStore");
    fileStore.writeMemories([]);
    fileStore.writeProfile({
        user: { name: "Louis" },
        preferences: { likes: [], dislikes: [] },
        relationship: { level: 1, points: 0 },
        timeline: []
    });

    const sid = "test-socket-personality";

    // ── Test 5: Style Mirroring & Adaptation ──────────────────────────────
    console.log("\n--- Test 5: Formality Mirroring & Learning ---");
    const initP = personalityEngine.getState(sid);
    
    // Send formal message
    const emotion = emotionEngine.getState(sid);
    const afterFormal = await personalityEngine.adapt(sid, "Could you please tell me if you appreciate this?", emotion);
    assert(afterFormal.formality > initP.formality, `formality increased after formal message (${afterFormal.formality.toFixed(3)} > ${initP.formality.toFixed(3)})`);

    // Send casual message
    const afterCasual = await personalityEngine.adapt(sid, "lol yo bro haha wanna go", emotion);
    assert(afterCasual.formality < afterFormal.formality, `formality decreased after casual message (${afterCasual.formality.toFixed(3)} < ${afterFormal.formality.toFixed(3)})`);

    // ── Test 6: Preference Learning ───────────────────────────────────────
    console.log("\n--- Test 6: Dynamic Preference Learning ---");
    await personalityEngine.adapt(sid, "I love sushi a lot!", emotion);
    
    // Check if written to long-term memory
    const memories = fileStore.readMemories();
    const sushiOk = memories.some(m => m.text.toLowerCase().includes("user likes: sushi"));
    assert(sushiOk, "learned like: sushi saved to memories.json");

    await personalityEngine.adapt(sid, "I hate rain", emotion);
    const rainOk = fileStore.readMemories().some(m => m.text.toLowerCase().includes("user dislikes: rain"));
    assert(rainOk, "learned dislike: rain saved to memories.json");

    // ── Test 7: Nickname Escalation ───────────────────────────────────────
    console.log("\n--- Test 7: Relationship Nickname Resolution ---");
    
    // Level 1: defaults to user name
    const pLvl1 = await personalityEngine.adapt(sid, "hello", emotion);
    assert(pLvl1.userNickname === "Louis", `level 1 nickname is name (got: "${pLvl1.userNickname}")`);

    // Update profile relationship level to 5
    const profile = memoryService.getProfile();
    profile.relationship.level = 5;
    fileStore.writeProfile(profile);

    const pLvl5 = await personalityEngine.adapt(sid, "hello", emotion);
    assert(pLvl5.userNickname === "Louis-senpai", `level 5 nickname is name-senpai (got: "${pLvl5.userNickname}")`);

    // Update profile relationship level to 7
    profile.relationship.level = 7;
    fileStore.writeProfile(profile);

    const pLvl7 = await personalityEngine.adapt(sid, "hello", emotion);
    console.log(`   Level 7 Nickname resolved to: "${pLvl7.userNickname}"`);
    assert(pLvl7.userNickname.includes("Louis") || pLvl7.userNickname.includes("human") || pLvl7.userNickname.includes("partner"), "level 7 nickname matches expectations");

    console.log("\n✨ Personality Engine verification completed!\n");
    process.exit(process.exitCode || 0);
}

run().catch(e => {
    console.error("Fatal verification error:", e.message);
    process.exit(1);
});
