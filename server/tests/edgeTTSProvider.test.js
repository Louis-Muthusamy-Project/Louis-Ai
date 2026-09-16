const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

// EdgeTTSProvider.synthesize() must call msedge-tts's setMetadata() with an
// EXPLICIT 3rd argument on every single call. The installed msedge-tts
// (v2.0.6/2.0.7) has a bug where its own locale-inference branch does
// `!metadataOptions.voiceLocale` without checking metadataOptions is
// defined first - omitting the 3rd argument works once (the buggy branch
// is short-circuited away on the very first call, since
// this._metadataOptions.voiceLocale starts unset) and then throws
// "Cannot read properties of undefined (reading 'voiceLocale')" on every
// call after that, because the provider reuses one long-lived MsEdgeTTS
// instance. That matches the reported runtime log exactly ("This error
// happens repeatedly"). These tests stub out msedge-tts itself (no real
// network call) and assert the call shape our code produces, plus that a
// second/third call in a row doesn't throw.

function loadEdgeTTSProviderWithStub() {
    const setMetadataCalls = [];
    let voiceLocaleAlreadySet = false;

    class FakeMsEdgeTTS {
        async setMetadata(voiceName, outputFormat, metadataOptions) {
            setMetadataCalls.push({ voiceName, outputFormat, metadataOptions });

            // Reproduce the real library's buggy branch faithfully: once a
            // voiceLocale has been set on a previous call, an omitted 3rd
            // argument throws when read.
            if (voiceLocaleAlreadySet && !metadataOptions) {
                // eslint-disable-next-line no-throw-literal
                throw new TypeError("Cannot read properties of undefined (reading 'voiceLocale')");
            }
            if (metadataOptions && metadataOptions.voiceLocale) {
                voiceLocaleAlreadySet = true;
            } else if (!voiceLocaleAlreadySet) {
                voiceLocaleAlreadySet = true;
            }
        }

        async toStream() {
            const { Readable } = require("stream");
            const audioStream = new Readable({ read() {} });
            process.nextTick(() => {
                audioStream.push(Buffer.from("fake-audio-bytes"));
                audioStream.push(null);
            });
            return { audioStream };
        }
    }

    const originalResolve = Module._resolveFilename;
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
        if (request === "msedge-tts") {
            return {
                MsEdgeTTS: FakeMsEdgeTTS,
                OUTPUT_FORMAT: { AUDIO_24KHZ_96KBITRATE_MONO_MP3: "audio-24khz-96kbitratemono-mp3" }
            };
        }
        return originalLoad.apply(this, arguments);
    };

    delete require.cache[require.resolve("../providers/tts/EdgeTTSProvider")];
    const EdgeTTSProvider = require("../providers/tts/EdgeTTSProvider");

    Module._load = originalLoad;
    Module._resolveFilename = originalResolve;

    return { EdgeTTSProvider, setMetadataCalls };
}

test("EdgeTTSProvider.detectLocale: derives the correct locale for every configured voice", () => {
    const { EdgeTTSProvider } = loadEdgeTTSProviderWithStub();
    const provider = new EdgeTTSProvider();

    assert.equal(provider.detectLocale("en-US-AvaNeural"), "en-US");
    assert.equal(provider.detectLocale("ta-IN-PallaviNeural"), "ta-IN");
    assert.equal(provider.detectLocale("ja-JP-NanamiNeural"), "ja-JP");
});

test("EdgeTTSProvider.synthesize: always passes an explicit metadataOptions.voiceLocale to setMetadata", async () => {
    const { EdgeTTSProvider, setMetadataCalls } = loadEdgeTTSProviderWithStub();
    const provider = new EdgeTTSProvider();

    await provider.synthesize({ text: "Hello Louis, how are you?" });

    assert.equal(setMetadataCalls.length, 1);
    assert.ok(setMetadataCalls[0].metadataOptions, "3rd argument must not be omitted");
    assert.equal(setMetadataCalls[0].metadataOptions.voiceLocale, "en-US");
});

test("EdgeTTSProvider.synthesize: repeated calls across languages never hit the omitted-metadataOptions bug", async () => {
    const { EdgeTTSProvider, setMetadataCalls } = loadEdgeTTSProviderWithStub();
    const provider = new EdgeTTSProvider();

    // English, then Tamil, then Japanese, then English again - the exact
    // repeated-call pattern that reproduced the reported stack trace
    // starting on the SECOND call.
    await provider.synthesize({ text: "Hello Louis, how are you?" });
    await provider.synthesize({ text: "வணக்கம், எப்படி இருக்கீங்க?" });
    await provider.synthesize({ text: "こんにちは、元気ですか？" });
    await provider.synthesize({ text: "Hello again" });

    assert.equal(setMetadataCalls.length, 4);
    assert.deepEqual(
        setMetadataCalls.map((c) => c.metadataOptions && c.metadataOptions.voiceLocale),
        ["en-US", "ta-IN", "ja-JP", "en-US"]
    );
});
