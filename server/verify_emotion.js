const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const EmotionState = require("./domain/EmotionState");
const EmotionEngine = require("./services/EmotionEngine");

function assert(condition, label) {
    const mark = condition ? "✅" : "❌";
    console.log(`${mark} ${label}`);
    if (!condition) process.exitCode = 1;
}

async function run() {
    console.log("=== Emotion AI Verification ===\n");

    // ── Test 1: EmotionState value object ─────────────────────────────────
    console.log("--- Test 1: EmotionState axes & clamping ---");
    const state = new EmotionState({ joy: 1.5, stress: -1, mood: 0.5 });
    assert(state.joy === 1.0,   "joy clamped to 1.0");
    assert(state.stress === 0.0,"stress clamped to 0.0");
    assert(state.mood === 0.5,  "mood preserved at 0.5");

    // ── Test 2: Primary emotion derivation ────────────────────────────────
    console.log("\n--- Test 2: Primary emotion derivation ---");
    assert(new EmotionState({ joy: 0.9, energy: 0.9 }).toPrimaryEmotion() === "excited", "high joy+energy → excited");
    assert(new EmotionState({ joy: 0.8, energy: 0.5 }).toPrimaryEmotion() === "happy",   "high joy → happy");
    assert(new EmotionState({ stress: 0.7 }).toPrimaryEmotion() === "anxious",            "high stress → anxious");
    assert(new EmotionState({ mood: -0.6 }).toPrimaryEmotion() === "sad",                 "very negative mood → sad");
    assert(new EmotionState({ curiosity: 0.8 }).toPrimaryEmotion() === "curious",         "high curiosity → curious");
    assert(new EmotionState({ focus: 0.8 }).toPrimaryEmotion() === "focused",             "high focus → focused");

    // ── Test 3: Decay ─────────────────────────────────────────────────────
    console.log("\n--- Test 3: Decay toward baseline ---");
    const highStress = new EmotionState({ stress: 0.9, joy: 0.1, energy: 0.2 });
    const decayed = highStress.decay(10);
    assert(decayed.stress < 0.9, `stress decayed (${decayed.stress.toFixed(3)} < 0.9)`);
    assert(decayed.joy > 0.1,    `joy recovered (${decayed.joy.toFixed(3)} > 0.1)`);
    assert(decayed.energy > 0.2, `energy recovered (${decayed.energy.toFixed(3)} > 0.2)`);
    // Trust should NOT decay
    const withTrust = new EmotionState({ trust: 0.8 });
    assert(withTrust.decay(100).trust === 0.8, "trust held constant (no decay)");

    // ── Test 4: Blending ──────────────────────────────────────────────────
    console.log("\n--- Test 4: State blending ---");
    const a = new EmotionState({ joy: 0.0 });
    const b = new EmotionState({ joy: 1.0 });
    const blended = a.blend(b, 0.5);
    assert(Math.abs(blended.joy - 0.5) < 0.001, `50/50 blend joy = 0.5 (got ${blended.joy})`);

    // ── Test 5: EmotionEngine text analysis ───────────────────────────────
    console.log("\n--- Test 5: EmotionEngine text analysis ---");
    const sid = "test-socket";
    EmotionEngine.reset(sid);

    const baseline = EmotionEngine.getState(sid);
    const afterHappy = EmotionEngine.analyzeText(sid, "I'm so happy today! I love this!", "CHAT");
    assert(afterHappy.joy > baseline.joy,   `joy increased after happy msg (${afterHappy.joy.toFixed(3)} > ${baseline.joy.toFixed(3)})`);
    assert(afterHappy.mood > baseline.mood, `mood increased after happy msg`);

    EmotionEngine.reset(sid);
    const afterSad = EmotionEngine.analyzeText(sid, "I feel so sad and tired today", "CHAT");
    assert(afterSad.joy < 0.5,             `joy decreased after sad msg (${afterSad.joy.toFixed(3)})`);
    assert(afterSad.energy < 0.7,         `energy decreased after tired msg (${afterSad.energy.toFixed(3)})`);

    EmotionEngine.reset(sid);
    const afterMath = EmotionEngine.analyzeText(sid, "What is 25 * 40?", "MATH");
    assert(afterMath.focus > 0.5,         `focus increased after MATH intent (${afterMath.focus.toFixed(3)})`);
    assert(afterMath.curiosity > 0.5,     `curiosity increased after question (${afterMath.curiosity.toFixed(3)})`);

    // ── Test 6: Mood history ──────────────────────────────────────────────
    console.log("\n--- Test 6: Mood history tracking ---");
    EmotionEngine.reset(sid);
    for (let i = 0; i < 5; i++) {
        EmotionEngine.analyzeText(sid, `Message ${i}`, "CHAT");
    }
    const history = EmotionEngine.getMoodHistory(sid);
    assert(history.length === 5, `History has 5 entries (got ${history.length})`);
    assert(history[0].state instanceof EmotionState, "History entries contain EmotionState");

    // ── Test 7: Prediction ────────────────────────────────────────────────
    console.log("\n--- Test 7: Emotion prediction ---");
    EmotionEngine.reset(sid);
    EmotionEngine.analyzeText(sid, "I'm feeling great!", "CHAT");
    EmotionEngine.analyzeText(sid, "This is so exciting!!!", "CHAT");
    const predicted = EmotionEngine.predict(sid);
    assert(typeof predicted === "string", `predict() returns string: "${predicted}"`);
    console.log(`   Predicted next emotion: "${predicted}"`);

    // ── Test 8: Relationship boost ────────────────────────────────────────
    console.log("\n--- Test 8: Relationship boost ---");
    EmotionEngine.reset(sid);
    const beforeBoost = EmotionEngine.getState(sid);
    EmotionEngine.applyRelationshipBoost(sid, 2);
    const afterBoost = EmotionEngine.getState(sid);
    assert(afterBoost.trust > beforeBoost.trust,
        `trust increased after relationship boost (${afterBoost.trust.toFixed(3)} > ${beforeBoost.trust.toFixed(3)})`);
    assert(afterBoost.attachment > beforeBoost.attachment,
        `attachment increased after relationship boost (${afterBoost.attachment.toFixed(3)})`);

    // ── Test 9: Prompt summary ────────────────────────────────────────────
    console.log("\n--- Test 9: Prompt summary serialization ---");
    const summary = new EmotionState({ joy: 0.8, stress: 0.2, energy: 0.9 }).toPromptSummary();
    assert(summary.includes("Primary Emotion"), "Prompt summary includes primary emotion");
    assert(summary.includes("Energy"),          "Prompt summary includes energy");
    assert(summary.includes("Stress"),          "Prompt summary includes stress");
    console.log("   Sample prompt summary snippet:");
    console.log("   " + summary.split("\n")[0]);

    // ── Test 10: Live2D param mapping ─────────────────────────────────────
    console.log("\n--- Test 10: Live2D parameter mapping ---");
    const l2d = new EmotionState({ curiosity: 0.8, joy: 0.9 }).toLive2DParams();
    assert(typeof l2d.ParamAngleX === "number",   "Live2D ParamAngleX is numeric");
    assert(typeof l2d.ParamEyeOpenL === "number", "Live2D ParamEyeOpenL is numeric");
    assert(l2d.ParamEyeOpenL > 0.7,              `ParamEyeOpenL boosted by curiosity (${l2d.ParamEyeOpenL.toFixed(3)})`);
    console.log("   Live2D Params:", JSON.stringify(l2d, null, 2).split("\n").slice(0, 6).join("\n   "));

    console.log("\n✨ Emotion AI verification completed!\n");
    process.exit(process.exitCode || 0);
}

run().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
