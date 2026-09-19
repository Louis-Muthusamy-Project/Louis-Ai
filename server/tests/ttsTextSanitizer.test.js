const test = require("node:test");
const assert = require("node:assert/strict");

const { sanitizeTtsText } = require("../utils/ttsTextSanitizer");
const Kernel = require("../core/Kernel");
const { TTSService } = require("../services/ttsService");

// voiceService.js registers a default EdgeTTSProvider onto the shared
// ttsService singleton at require-time, which itself resolves through the
// Kernel - needs a real registration to exist before that first require
// happens anywhere in a standalone test run (bootstrap.js normally does
// this at app startup). Same setup as voiceCancellation.test.js.
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

// ── Pure sanitizeTtsText() unit tests (cases 1-9 + 12 from the spec) ───────

test("sanitizeTtsText: English + emoji", () => {
    assert.equal(sanitizeTtsText("Hello Yuna 😊"), "Hello Yuna");
});

test("sanitizeTtsText: Tamil + emoji", () => {
    assert.equal(sanitizeTtsText("வணக்கம் தங்கப்புள்ள ❤️"), "வணக்கம் தங்கப்புள்ள");
});

test("sanitizeTtsText: Japanese + emoji", () => {
    assert.equal(sanitizeTtsText("こんにちは 😊"), "こんにちは");
});

test("sanitizeTtsText: multiple emojis", () => {
    assert.equal(sanitizeTtsText("Hello 😂🔥❤️✨"), "Hello");
});

test("sanitizeTtsText: emoji sequences (family, flag, skin-tone, ZWJ) are completely removed", () => {
    assert.equal(sanitizeTtsText("👨‍👩‍👧‍👦"), ""); // family ZWJ sequence
    assert.equal(sanitizeTtsText("🇺🇸"), ""); // flag (regional indicator pair)
    assert.equal(sanitizeTtsText("👍🏽"), ""); // thumbs up + skin-tone modifier
    assert.equal(sanitizeTtsText("🧑‍⚕️"), ""); // gender-neutral health worker (ZWJ + variation selector)
    assert.equal(sanitizeTtsText("Team 👨‍👩‍👧‍👦🇺🇸👍🏽!"), "Team!");
});

test("sanitizeTtsText: no stray space is left before punctuation once the emoji in front of it is removed", () => {
    // Corrected behavior: "Hello 😊!" reads naturally as "Hello!", not
    // "Hello !" with an orphaned space where the emoji used to sit.
    assert.equal(sanitizeTtsText("Hello 😊!"), "Hello!");
    assert.equal(sanitizeTtsText("Hello 😊! How are you?"), "Hello! How are you?");
});

test("sanitizeTtsText: punctuation cleanup also applies to non-English scripts", () => {
    assert.equal(sanitizeTtsText("வணக்கம் ❤️!"), "வணக்கம்!");
});

test("sanitizeTtsText: punctuation cleanup applies to a comma, not just '!'", () => {
    assert.equal(sanitizeTtsText("Hi 😊, how are you?"), "Hi, how are you?");
});

test("sanitizeTtsText: punctuation cleanup covers the full required set . , ! ? : ; ) ] }", () => {
    assert.equal(sanitizeTtsText("Done 😊."), "Done.");
    assert.equal(sanitizeTtsText("Really 😊?"), "Really?");
    assert.equal(sanitizeTtsText("Note 😊:"), "Note:");
    assert.equal(sanitizeTtsText("Wait 😊;"), "Wait;");
    assert.equal(sanitizeTtsText("(hello 😊)"), "(hello)");
    assert.equal(sanitizeTtsText("[list 😊]"), "[list]");
    assert.equal(sanitizeTtsText("{set 😊}"), "{set}");
});

test("sanitizeTtsText: normal mid-sentence word spacing is left untouched by the punctuation cleanup", () => {
    assert.equal(sanitizeTtsText("Hello there 😊 my friend"), "Hello there my friend");
});

test("sanitizeTtsText: numbers are preserved, including inside a keycap emoji", () => {
    assert.equal(sanitizeTtsText("Order 123 😊"), "Order 123");
    // Keycap emoji ("1️⃣" = digit + variation selector + combining enclosing
    // keycap) - the emoji WRAPPER is removed, the digit itself is a normal
    // character and must survive.
    assert.equal(sanitizeTtsText("Table 1\u{FE0F}\u{20E3} is ready"), "Table 1 is ready");
});

test("sanitizeTtsText: emoji-only message sanitizes to an empty string", () => {
    assert.equal(sanitizeTtsText("😊❤️🔥"), "");
});

test("sanitizeTtsText: null/undefined/non-string input never throws and returns a safe empty result", () => {
    assert.equal(sanitizeTtsText(null), "");
    assert.equal(sanitizeTtsText(undefined), "");
    assert.equal(sanitizeTtsText(42), "");
    assert.equal(sanitizeTtsText({}), "");
});

test("sanitizeTtsText: empty and whitespace-only strings return an empty string", () => {
    assert.equal(sanitizeTtsText(""), "");
    assert.equal(sanitizeTtsText("   "), "");
    assert.equal(sanitizeTtsText("\n\t "), "");
});

test("sanitizeTtsText: English, Tamil and Japanese all survive sanitization in one mixed message", () => {
    const input = "Hi Yuna 😊 ❤️, எப்படி இருக்க? 調子はどう？";
    const result = sanitizeTtsText(input);
    assert.equal(result.includes("Hi Yuna"), true);
    assert.equal(result.includes("எப்படி இருக்க?"), true);
    assert.equal(result.includes("調子はどう？"), true);
    assert.equal(/\p{Extended_Pictographic}/u.test(result), false);
});

test("sanitizeTtsText: accidental repeated whitespace from removed emojis is collapsed", () => {
    assert.equal(sanitizeTtsText("Hi  😊  😊  there"), "Hi there");
});

// ── Integration: voiceService.speak() actually uses the sanitizer ─────────

test("voiceService.speak: sends the sanitized (emoji-free) text to the TTS provider, never the original", async () => {
    let capturedText = null;
    const { voiceService, restore } = makeVoiceService({
        synthesize: async ({ text }) => {
            capturedText = text;
            return { audio: Buffer.from("fake"), mimeType: "audio/mpeg", voice: "en-US-AvaNeural" };
        }
    });
    try {
        await voiceService.speak({ text: "Hi Yuna 😊 ❤️, how are you?", ownerId: "user-1" });
        assert.equal(capturedText, "Hi Yuna, how are you?");
        assert.equal(/\p{Extended_Pictographic}/u.test(capturedText), false);
    } finally {
        restore();
    }
});

test("voiceService.speak: does NOT call the TTS provider when the sanitized text is empty (emoji-only segment)", async () => {
    let called = false;
    const { voiceService, restore } = makeVoiceService({
        synthesize: async () => {
            called = true;
            return { audio: Buffer.from("fake"), mimeType: "audio/mpeg", voice: "en-US-AvaNeural" };
        }
    });
    try {
        await voiceService.speak({ text: "😊❤️🔥", ownerId: "user-1" });
        assert.equal(called, false);
        assert.equal(voiceService.getState(), "idle");
    } finally {
        restore();
    }
});

test("voiceService.speak: emits a clean voice:no-speech result (not an error) for an emoji-only segment", async () => {
    const { voiceService, restore } = makeVoiceService();
    try {
        let noSpeechEvent = null;
        let errorEvent = null;
        voiceService.once("voice:no-speech", (payload) => { noSpeechEvent = payload; });
        voiceService.once("voice:error", (payload) => { errorEvent = payload; });

        await voiceService.speak({ text: "🔥✨", ownerId: "user-1" });

        assert.ok(noSpeechEvent);
        assert.equal(noSpeechEvent.ownerId, "user-1");
        assert.equal(errorEvent, null);
    } finally {
        restore();
    }
});

test("voiceService.speak: the original text (with emojis) is still what's reported on voice:audio, for chat/UI display", async () => {
    const { voiceService, restore } = makeVoiceService();
    try {
        let audioEvent = null;
        voiceService.once("voice:audio", (payload) => { audioEvent = payload; });

        const originalText = "Hi Yuna 😊 ❤️, எப்படி இருக்க?";
        await voiceService.speak({ text: originalText, ownerId: "user-1" });

        assert.ok(audioEvent);
        assert.equal(audioEvent.text, originalText);
    } finally {
        restore();
    }
});

test("voiceService.speak: the original message object/string passed in is never mutated (chat/history stays untouched)", async () => {
    const { voiceService, restore } = makeVoiceService();
    try {
        const segment = { text: "Hi Yuna 😊 ❤️", ownerId: "user-1" };
        const originalText = segment.text;

        await voiceService.speak(segment);

        // sanitizeTtsText only ever produces a NEW string - the segment
        // object's own `text` field (which is what a caller like chat
        // history would be holding a reference to) is untouched.
        assert.equal(segment.text, originalText);
        assert.equal(segment.text.includes("😊"), true);
        assert.equal(segment.text.includes("❤️"), true);
    } finally {
        restore();
    }
});
