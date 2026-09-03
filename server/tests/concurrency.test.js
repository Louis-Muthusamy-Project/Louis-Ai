const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const FileMemoryRepository = require("../infrastructure/FileMemoryRepository");
const MemoryService = require("../services/memoryService").MemoryService
    ? require("../services/memoryService").MemoryService
    : require("../services/memoryService");
const ScheduleService = require("../services/scheduleService");
const SettingsFileStore = require("../infrastructure/SettingsFileStore");

function isolatedRoot(prefix) {
    return path.join(os.tmpdir(), `yuna-test-${prefix}-${Date.now()}-${Math.random()}`);
}

function makeMemoryService() {
    const repo = new FileMemoryRepository();
    repo.dataRoot = isolatedRoot("memroot");

    let embedCounter = 0;
    const fakeProviderManager = {
        // Deterministic, distinct-enough embeddings so cosineSimilarity
        // in cleanupMemories doesn't treat unrelated test memories as
        // duplicates of each other.
        async embed() {
            embedCounter += 1;
            const v = new Array(8).fill(0);
            v[embedCounter % 8] = 1;
            return v;
        },
        async generate() {
            return "5"; // importance score
        }
    };

    const kernel = {
        get: (name) => {
            if (name === "memoryRepository") return repo;
            if (name === "providerManager") return fakeProviderManager;
            return null;
        }
    };

    return new MemoryService(kernel);
}

// ── A + E: same-user concurrent writes must not lose either update ──────

test("MemoryService: two concurrent saveLongTermMemory calls for the SAME user both persist (no lost update)", async () => {
    const svc = makeMemoryService();
    const userId = "user-concurrent-a";

    await Promise.all([
        svc.saveLongTermMemory(userId, "I like hiking", "preference", 5),
        svc.saveLongTermMemory(userId, "My birthday is in March", "profile", 5)
    ]);

    const memories = await svc.repository.readMemories(userId);
    const texts = memories.map(m => m.text);

    assert.ok(texts.includes("I like hiking"), "first concurrent write must not be lost");
    assert.ok(texts.includes("My birthday is in March"), "second concurrent write must not be lost");
    assert.equal(memories.length, 2);
});

test("MemoryService: five concurrent saveLongTermMemory calls for the same user all persist", async () => {
    const svc = makeMemoryService();
    const userId = "user-concurrent-many";

    await Promise.all(
        Array.from({ length: 5 }, (_, i) => svc.saveLongTermMemory(userId, `Fact number ${i}`, "general", 3))
    );

    const memories = await svc.repository.readMemories(userId);
    assert.equal(memories.length, 5, "all 5 concurrent writes must be present, none silently dropped");
});

// ── B: concurrent writes from two different users never cross-contaminate ──

test("MemoryService: concurrent writes from two different users stay fully isolated", async () => {
    const svc = makeMemoryService();

    await Promise.all([
        svc.saveLongTermMemory("user-x", "User X's secret", "general", 5),
        svc.saveLongTermMemory("user-y", "User Y's secret", "general", 5)
    ]);

    const xMemories = await svc.repository.readMemories("user-x");
    const yMemories = await svc.repository.readMemories("user-y");

    assert.equal(xMemories.length, 1);
    assert.equal(yMemories.length, 1);
    assert.equal(xMemories[0].text, "User X's secret");
    assert.equal(yMemories[0].text, "User Y's secret");
});

// ── C: concurrent update + read never sees a partial/corrupted state ───────

test("MemoryService: a save racing a cleanup never leaves a partial/corrupted memory set", async () => {
    const svc = makeMemoryService();
    const userId = "user-race-cleanup";

    // Seed a couple of memories first (sequential, to set up the race below).
    await svc.saveLongTermMemory(userId, "Seed memory one", "general", 5);
    await svc.saveLongTermMemory(userId, "Seed memory two", "general", 5);

    // Now race a real save against an explicit cleanup call - this mirrors
    // the actual production pattern (saveLongTermMemory fires cleanupMemories
    // without awaiting it).
    await Promise.all([
        svc.saveLongTermMemory(userId, "Raced memory", "general", 5),
        svc.cleanupMemories(userId)
    ]);

    const memories = await svc.repository.readMemories(userId);
    // Every entry must be well-formed - never a torn/partial write.
    for (const m of memories) {
        assert.equal(typeof m.text, "string");
        assert.ok(m.text.length > 0);
        assert.ok(Array.isArray(m.embedding));
    }
    const texts = memories.map(m => m.text);
    assert.ok(texts.includes("Raced memory"), "the write that raced cleanup must not have been lost");
});

// ── D: concurrent create + cancel on ScheduleService ────────────────────

test("ScheduleService: concurrent addReminder + cancelTask for the same user leaves a consistent state", async () => {
    const kernel = { get: (name) => (name === "eventBus" ? new (require("events").EventEmitter)() : null) };
    const svc = new ScheduleService(kernel);
    svc.dataRoot = isolatedRoot("schedconcurrent");
    svc.legacyPath = path.join(svc.dataRoot, "__no_legacy__.json");
    await svc.initialize();

    const userId = "user-schedule-race";
    const existingId = await svc.addReminder(userId, new Date(Date.now() + 3600_000).toISOString(), "Existing reminder");

    await Promise.all([
        svc.addReminder(userId, new Date(Date.now() + 7200_000).toISOString(), "New reminder"),
        svc.cancelTask(userId, existingId)
    ]);

    const tasks = svc.listTasks(userId);
    assert.ok(!tasks[existingId], "cancelled task must be gone");
    const remaining = Object.values(tasks);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].message, "New reminder");

    // Clean up the still-pending node-schedule timer.
    const newId = Object.keys(tasks)[0];
    await svc.cancelTask(userId, newId);
});

// ── SettingsFileStore: concurrent writes never corrupt the file ────────────

test("SettingsFileStore: concurrent writes for the same user always leave valid, readable JSON", async () => {
    const store = new SettingsFileStore();
    store.dataRoot = isolatedRoot("settingsconcurrent");
    store.legacyPath = path.join(store.dataRoot, "__no_legacy__.json");

    const userId = "user-settings-race";

    await Promise.all([
        store.write(userId, { theme: "dark", n: 1 }),
        store.write(userId, { theme: "light", n: 2 }),
        store.write(userId, { theme: "dark", n: 3 })
    ]);

    // Whichever write "won" the race, the file must be intact, valid JSON -
    // never a half-written/corrupted merge of two concurrent writes.
    const result = store.read(userId);
    assert.ok([1, 2, 3].includes(result.n));
    assert.ok(["dark", "light"].includes(result.theme));
});
