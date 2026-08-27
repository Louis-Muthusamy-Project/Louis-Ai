const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const FileMemoryRepository = require("../infrastructure/FileMemoryRepository");

function makeIsolatedRepo() {
    const repo = new FileMemoryRepository();
    repo.dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-test-memory-"));
    return repo;
}

test("two users' profiles never collide", async () => {
    const repo = makeIsolatedRepo();

    await repo.writeProfile("user-A", { user: { name: "Alice" }, preferences: {}, goals: [], projects: [], relationship: { level: 1, points: 0 }, timeline: [] });
    await repo.writeProfile("user-B", { user: { name: "Bob" }, preferences: {}, goals: [], projects: [], relationship: { level: 1, points: 0 }, timeline: [] });

    const profileA = await repo.readProfile("user-A");
    const profileB = await repo.readProfile("user-B");

    assert.equal(profileA.user.name, "Alice");
    assert.equal(profileB.user.name, "Bob");
});

test("two users' long-term memories never collide", async () => {
    const repo = makeIsolatedRepo();

    await repo.writeMemories("user-A", [{ text: "Alice secret", embedding: [1, 0], importance: 9, category: "general" }]);
    await repo.writeMemories("user-B", [{ text: "Bob secret", embedding: [0, 1], importance: 9, category: "general" }]);

    const memA = await repo.readMemories("user-A");
    const memB = await repo.readMemories("user-B");

    assert.equal(memA.length, 1);
    assert.equal(memB.length, 1);
    assert.equal(memA[0].text, "Alice secret");
    assert.equal(memB[0].text, "Bob secret");
});

test("a user with no data yet gets the default profile, not another user's", async () => {
    const repo = makeIsolatedRepo();
    await repo.writeProfile("user-A", { user: { name: "Alice" }, preferences: {}, goals: [], projects: [], relationship: { level: 1, points: 0 }, timeline: [] });

    const freshUserProfile = await repo.readProfile("brand-new-user");
    assert.equal(freshUserProfile.user.name, "User"); // default, unrelated to Alice
});

test("path traversal in a userId cannot escape the per-user directory", async () => {
    const repo = makeIsolatedRepo();
    const maliciousId = "../../../etc/passwd";

    await repo.writeProfile(maliciousId, { user: { name: "Attacker" }, preferences: {}, goals: [], projects: [], relationship: { level: 1, points: 0 }, timeline: [] });

    // The write must have landed inside dataRoot (sanitized), never above it.
    const entries = fs.readdirSync(repo.dataRoot);
    assert.ok(entries.every(e => !e.includes("..")));
});
