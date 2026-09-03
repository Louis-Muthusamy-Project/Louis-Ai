const test = require("node:test");
const assert = require("node:assert/strict");

const Kernel = require("../core/Kernel");
const { TTSService } = require("../services/ttsService");

// voiceService.js registers a default EdgeTTSProvider onto the shared
// ttsService singleton at require-time, which itself resolves through the
// Kernel - needs a real registration to exist before that first require
// happens anywhere in a standalone test run (bootstrap.js normally does
// this at app startup).
if (!Kernel.has || !Kernel.has("ttsService")) {
    try {
        Kernel.register("ttsService", new TTSService(Kernel));
    } catch (e) {
        // Already registered by an earlier test file in this run - fine.
    }
}

function makeVoiceService(ttsOverrides = {}) {
    delete require.cache[require.resolve("../services/voiceService")];
    const voiceService = require("../services/voiceService");

    const ttsServiceModule = require("../services/ttsService");
    const originalSynthesize = ttsServiceModule.synthesize;
    ttsServiceModule.synthesize = ttsOverrides.synthesize || (async ({ text }) => ({
        audio: Buffer.from("fake-mp3-bytes"),
        mimeType: "audio/mpeg",
        voice: "en-US-AvaNeural"
    }));

    return { voiceService, restore: () => { ttsServiceModule.synthesize = originalSynthesize; } };
}

test("voiceService.enqueue: does nothing (and warns) without an ownerId, since audio can't be routed safely", () => {
    const { voiceService, restore } = makeVoiceService();
    try {
        voiceService.enqueue("hello", undefined);
        assert.equal(voiceService.queue.length, 0);
    } finally {
        restore();
    }
});

test("voiceService.enqueue: does nothing for empty text", () => {
    const { voiceService, restore } = makeVoiceService();
    try {
        voiceService.enqueue("", "user-1");
        voiceService.enqueue("   ", "user-1");
        assert.equal(voiceService.queue.length, 0);
    } finally {
        restore();
    }
});

test("voiceService.cancelForUser: removes only the target user's queued segments, leaving other users' untouched", () => {
    const { voiceService, restore } = makeVoiceService();
    try {
        // Manually populate the queue rather than calling enqueue (which
        // would immediately start draining it via playQueue()).
        voiceService.currentState = "speaking";
        voiceService._currentOwnerId = "someone-else-entirely";
        voiceService.queue = [
            { text: "A1", ownerId: "user-a" },
            { text: "B1", ownerId: "user-b" },
            { text: "A2", ownerId: "user-a" }
        ];

        voiceService.cancelForUser("user-a");

        const remaining = voiceService.queue.map(s => s.ownerId);
        assert.deepEqual(remaining, ["user-b"]);
    } finally {
        voiceService.currentState = "idle";
        voiceService.queue = [];
        restore();
    }
});

test("voiceService.cancelForUser: interrupts the CURRENT segment only if it belongs to that user", () => {
    const { voiceService, restore } = makeVoiceService();
    try {
        voiceService.currentState = "speaking";
        voiceService._currentOwnerId = "user-a";
        voiceService.queue = [];

        voiceService.cancelForUser("user-a");

        assert.equal(voiceService.currentState, "interrupted");
    } finally {
        voiceService.currentState = "idle";
        restore();
    }
});

test("voiceService.cancelForUser: does NOT interrupt a different user's currently-playing segment", () => {
    const { voiceService, restore } = makeVoiceService();
    try {
        voiceService.currentState = "speaking";
        voiceService._currentOwnerId = "user-b";
        voiceService.queue = [];

        voiceService.cancelForUser("user-a");

        assert.equal(voiceService.currentState, "speaking", "cancelling user A must not interrupt user B's active speech");
    } finally {
        voiceService.currentState = "idle";
        restore();
    }
});

test("voiceService.speak: a TTS provider failure emits voice:error and returns to idle without throwing", async () => {
    const { voiceService, restore } = makeVoiceService({
        synthesize: async () => { throw new Error("TTS provider unavailable"); }
    });
    try {
        let errorPayload = null;
        voiceService.once("voice:error", (data) => { errorPayload = data; });

        await voiceService.speak({ text: "hello", ownerId: "user-1" });

        assert.ok(errorPayload);
        assert.match(errorPayload.error, /TTS provider unavailable/);
        assert.equal(voiceService.currentState, "idle");
    } finally {
        restore();
    }
});

test("voiceService.speak: never crashes on empty synthesized audio - EdgeTTSProvider itself guards against 0-byte output", async () => {
    // This is really exercised in EdgeTTSProvider directly (see
    // dataIsolation.test.js's provider tests), but confirm the voiceService
    // layer surfaces a synthesize() rejection as voice:error rather than
    // throwing out of speak() uncaught.
    const { voiceService, restore } = makeVoiceService({
        synthesize: async () => { throw new Error("EdgeTTSProvider produced empty audio for voice x"); }
    });
    try {
        let errored = false;
        voiceService.once("voice:error", () => { errored = true; });
        await assert.doesNotReject(voiceService.speak({ text: "hi", ownerId: "user-1" }));
        assert.equal(errored, true);
    } finally {
        restore();
    }
});
