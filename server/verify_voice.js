const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const bootstrap = require("./bootstrap");
const Kernel = require("./core/Kernel");

function assert(condition, label) {
    const mark = condition ? "✅" : "❌";
    console.log(`${mark} ${label}`);
    if (!condition) process.exitCode = 1;
}

async function run() {
    console.log("=== Voice System Verification ===\n");

    console.log("Bootstrapping kernel...");
    await bootstrap();

    const voiceService = Kernel.get("voiceService");
    assert(!!voiceService, "voiceService resolved from Kernel");

    // ── Test 1: Speech State Machine ──────────────────────────────────────
    console.log("\n--- Test 1: Speech State Machine ---");
    assert(voiceService.getState() === "idle", "default state is idle");

    // ── Test 2: Voice Provider Switch ──────────────────────────────────────
    console.log("\n--- Test 2: Multiple Voice Providers ---");
    assert(voiceService.activeProviderName === "edge", "defaults to edge provider");
    voiceService.setProvider("premium");
    assert(voiceService.activeProviderName === "premium", "successfully switched to premium provider");
    
    // Switch back to edge
    voiceService.setProvider("edge");
    assert(voiceService.activeProviderName === "edge", "successfully switched back to edge provider");

    // ── Test 3: Wake Word Detection ────────────────────────────────────────
    console.log("\n--- Test 3: Wake Word Detection ---");
    let woke = false;
    voiceService.once("voice:wake", () => { woke = true; });
    
    const hasWakeWord = voiceService.detectWakeWord("Hey Yuna, are you awake?");
    assert(hasWakeWord === true, "detects 'hey yuna' wake word");
    assert(woke === true, "voice:wake event emitted");

    const noWakeWord = voiceService.detectWakeWord("What is the time right now?");
    assert(noWakeWord === false, "does not trigger on random text");

    // ── Test 4: Voice Identification & Noise Reduction ────────────────────
    console.log("\n--- Test 4: Voice Identification & Noise Reduction ---");
    const idResult = voiceService.identifyVoice("low-resonance-standard");
    assert(idResult.identified === true && idResult.user === "Louis", "identifies Louis via signature");
    
    const noiseReduced = voiceService.applyNoiseReduction(Buffer.from([1,2,3]));
    assert(noiseReduced !== null, "noise reduction filter executes and returns buffer");

    // ── Test 5: Lip Sync Timings ──────────────────────────────────────────
    console.log("\n--- Test 5: Lip Sync Visemes calculation ---");
    const visemes = voiceService.calculateLipSync("Hello companion app");
    assert(visemes.length > 0, "visemes array generated");
    assert(visemes[0].time === 0, "first viseme timing starts at 0ms");
    assert(typeof visemes[0].opening === "number", "viseme opening is a numeric value");
    console.log("   Generated Visemes sample:", JSON.stringify(visemes.slice(0, 3)));

    // ── Test 6: Sentence Splitting Queue ──────────────────────────────────
    console.log("\n--- Test 6: Queue splitting and async execution ---");
    voiceService.clearQueue();
    voiceService.enqueue("First segment. Second segment! Third segment?");
    
    // The queue should split these into 3 separate sentences
    assert(voiceService.queue.length === 2, "first segment immediately popped to play, remaining 2 in queue");
    assert(voiceService.queue[0].text === "Second segment!", "second segment matches sentence 2");
    assert(voiceService.queue[1].text === "Third segment?", "third segment matches sentence 3");

    // ── Test 7: Speech Interruption ────────────────────────────────────────
    console.log("\n--- Test 7: Interrupt Speech ---");
    let interrupted = false;
    voiceService.once("voice:interrupted", () => { interrupted = true; });
    
    voiceService.stop();
    assert(voiceService.getState() === "interrupted", "state transitions to interrupted");
    assert(voiceService.queue.length === 0, "queue is cleared on interrupt");
    assert(interrupted === true, "voice:interrupted event emitted");

    console.log("\n✨ Voice System verification completed!\n");
    process.exit(process.exitCode || 0);
}

run().catch(e => {
    console.error("Fatal verification error:", e.message);
    process.exit(1);
});
