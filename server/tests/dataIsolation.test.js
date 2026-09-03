const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

// ── SettingsFileStore isolation ──────────────────────────────────────────

const SettingsFileStore = require("../infrastructure/SettingsFileStore");

function makeIsolatedSettingsStore() {
    const store = new SettingsFileStore();
    store.dataRoot = path.join(os.tmpdir(), `yuna-test-settings-${Date.now()}-${Math.random()}`);
    store.legacyPath = path.join(store.dataRoot, "__no_legacy_file_here__.json");
    return store;
}

test("SettingsFileStore: two users never see each other's settings", async () => {
    const store = makeIsolatedSettingsStore();

    await store.write("user-a", { theme: "dark", model: "gemini-2.5-flash" });
    await store.write("user-b", { theme: "light", model: "gemini-2.5-pro" });

    const a = store.read("user-a");
    const b = store.read("user-b");

    assert.equal(a.theme, "dark");
    assert.equal(b.theme, "light");
    assert.notEqual(a.model, b.model);
});

test("SettingsFileStore: unwritten user gets an empty object, not another user's data", async () => {
    const store = makeIsolatedSettingsStore();
    await store.write("user-a", { theme: "dark" });

    const fresh = store.read("brand-new-user");
    assert.deepEqual(fresh, {});
});

test("SettingsFileStore: a malicious userId cannot escape the per-user directory", async () => {
    const store = makeIsolatedSettingsStore();
    const maliciousId = "../../../etc/passwd";

    await store.write(maliciousId, { pwned: true });

    // The written file must land inside dataRoot, never outside it.
    const filePath = store._filePath(maliciousId);
    const resolved = path.resolve(filePath);
    assert.ok(resolved.startsWith(path.resolve(store.dataRoot)));
});

// ── ScheduleService isolation ────────────────────────────────────────────

const ScheduleService = require("../services/scheduleService");

test("ScheduleService: one user cannot list, read, or cancel another user's tasks", async () => {
    const SS = ScheduleService;
    const kernel = { get: (name) => (name === "eventBus" ? new (require("events").EventEmitter)() : null) };
    const svc = new SS(kernel);
    svc.dataRoot = path.join(os.tmpdir(), `yuna-test-schedule-${Date.now()}-${Math.random()}`);
    svc.legacyPath = path.join(svc.dataRoot, "__no_legacy_file_here__.json");
    await svc.initialize();

    const idA = await svc.addReminder("user-a", new Date(Date.now() + 3600_000).toISOString(), "Water the plants");
    const idB = await svc.addReminder("user-b", new Date(Date.now() + 3600_000).toISOString(), "Call the dentist");

    const tasksForA = svc.listTasks("user-a");
    const tasksForB = svc.listTasks("user-b");

    assert.ok(tasksForA[idA]);
    assert.ok(!tasksForA[idB], "user A must not see user B's task");
    assert.ok(tasksForB[idB]);
    assert.ok(!tasksForB[idA], "user B must not see user A's task");

    // User B attempts to cancel user A's task id - must be a silent no-op,
    // never actually cancelling it.
    await svc.cancelTask("user-b", idA);
    assert.ok(svc.listTasks("user-a")[idA], "cross-user cancel must not have removed the task");

    // The rightful owner can cancel their own task.
    await svc.cancelTask("user-a", idA);
    assert.ok(!svc.listTasks("user-a")[idA]);

    // Clean up idB's still-pending node-schedule timer so it doesn't keep
    // the test process alive for the next hour.
    await svc.cancelTask("user-b", idB);
});

test("ScheduleService: requires an ownerId for every operation", () => {
    const SS = ScheduleService;
    const kernel = { get: () => new (require("events").EventEmitter)() };
    const svc = new SS(kernel);
    assert.throws(() => svc.listTasks(undefined));
    assert.rejects(() => svc.addTimer(undefined, 10, "x"));
});

// ── EdgeTTSProvider language/voice selection ─────────────────────────────

const EdgeTTSProvider = require("../providers/tts/EdgeTTSProvider");
const voiceConfig = require("../config/voice");

test("EdgeTTSProvider.detectVoice: routes English, Tamil, and Japanese to their own configured voice, never falling back to English for Japanese", () => {
    const provider = new EdgeTTSProvider();

    assert.equal(provider.detectVoice("Hello, how are you?"), voiceConfig.voice.english);
    assert.equal(provider.detectVoice("வணக்கம், எப்படி இருக்கிறீர்கள்?"), voiceConfig.voice.tamil);
    assert.equal(provider.detectVoice("こんにちは、元気ですか？"), voiceConfig.voice.japanese);
    assert.notEqual(voiceConfig.voice.japanese, voiceConfig.voice.english);
});

test("EdgeTTSProvider source contains no permanent temp-file writes", () => {
    // Guards against regressing back to the old fs.createWriteStream(temp/...)
    // pattern - this file should now be pure in-memory buffer synthesis.
    const src = fs.readFileSync(
        path.join(__dirname, "..", "providers", "tts", "EdgeTTSProvider.js"),
        "utf8"
    );
    assert.ok(!/createWriteStream/.test(src));
    assert.ok(!/process\.cwd\(\)\s*,\s*["']temp["']/.test(src));
});

test("EdgeTTSProvider.detectVoice: mixed-language text picks the dominant script, not merely 'any non-English char present'", () => {
    const provider = new EdgeTTSProvider();

    // Pure per-language (still correct after the dominant-script rewrite)
    assert.equal(provider.detectVoice("Hello Yuna"), voiceConfig.voice.english);
    assert.equal(provider.detectVoice("வணக்கம் Yuna"), voiceConfig.voice.tamil);
    assert.equal(provider.detectVoice("こんにちは、Yuna"), voiceConfig.voice.japanese);

    // A short Japanese greeting plus an English name of similar length -
    // ties (or near-ties) favor the script-based language over Latin.
    assert.equal(provider.detectVoice("こんにちは Louis"), voiceConfig.voice.japanese);

    // Empty text never crashes and defaults sensibly.
    assert.equal(provider.detectVoice(""), voiceConfig.voice.english);
    assert.equal(provider.detectVoice(null), voiceConfig.voice.english);
});
