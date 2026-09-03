const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const MONGO_URI = process.env.YUNA_TEST_MONGO_URI || "mongodb://127.0.0.1:27017/yuna_test_concurrency";

let mongoAvailable = false;

test.before(async () => {
    try {
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2000 });
        mongoAvailable = true;
    } catch (error) {
        mongoAvailable = false;
        console.log(
            `[mongoConcurrency.test.js] No reachable MongoDB at ${MONGO_URI} (${error.message}). ` +
            "These tests are being skipped, NOT counted as passing - run with a real MongoDB " +
            "instance (e.g. set YUNA_TEST_MONGO_URI) to actually execute them."
        );
    }
});

test.after(async () => {
    if (mongoAvailable) {
        // Clean up the test database and disconnect.
        await mongoose.connection.dropDatabase().catch(() => {});
        await mongoose.disconnect().catch(() => {});
    }
});

test("MongoMemoryRepository: two concurrent writeMemories calls for the same user don't lose data", async (t) => {
    if (!mongoAvailable) {
        t.skip("No MongoDB instance reachable in this environment.");
        return;
    }

    delete require.cache[require.resolve("../infrastructure/MongoMemoryRepository")];
    const MongoMemoryRepository = require("../infrastructure/MongoMemoryRepository");
    const repo = new MongoMemoryRepository();
    const userId = "mongo-user-concurrent";

    await Promise.all([
        repo.writeMemories(userId, [{ id: "m1", text: "Fact A", embedding: [1, 0], importance: 5, category: "general" }]),
        repo.writeMemories(userId, [
            { id: "m1", text: "Fact A", embedding: [1, 0], importance: 5, category: "general" },
            { id: "m2", text: "Fact B", embedding: [0, 1], importance: 5, category: "general" }
        ])
    ]);

    const memories = await repo.readMemories(userId);
    assert.ok(memories.length >= 1, "collection must never end up empty from an interleaved deleteMany/insertMany");
});

test("MongoMemoryRepository: concurrent writes from two different users stay isolated", async (t) => {
    if (!mongoAvailable) {
        t.skip("No MongoDB instance reachable in this environment.");
        return;
    }

    const MongoMemoryRepository = require("../infrastructure/MongoMemoryRepository");
    const repo = new MongoMemoryRepository();

    await Promise.all([
        repo.writeMemories("mongo-user-x", [{ id: "x1", text: "X secret", embedding: [1], importance: 5, category: "general" }]),
        repo.writeMemories("mongo-user-y", [{ id: "y1", text: "Y secret", embedding: [1], importance: 5, category: "general" }])
    ]);

    const xMemories = await repo.readMemories("mongo-user-x");
    const yMemories = await repo.readMemories("mongo-user-y");

    assert.equal(xMemories.length, 1);
    assert.equal(yMemories.length, 1);
    assert.equal(xMemories[0].text, "X secret");
    assert.equal(yMemories[0].text, "Y secret");
});

test("MongoMemoryRepository: writeMemories never fully empties the collection mid-write (no deleteMany-then-insertMany window)", async (t) => {
    if (!mongoAvailable) {
        t.skip("No MongoDB instance reachable in this environment.");
        return;
    }

    const MongoMemoryRepository = require("../infrastructure/MongoMemoryRepository");
    const repo = new MongoMemoryRepository();
    const userId = "mongo-user-no-empty-window";

    await repo.writeMemories(userId, [
        { id: "a", text: "Alpha", embedding: [1], importance: 5, category: "general" },
        { id: "b", text: "Beta", embedding: [1], importance: 5, category: "general" }
    ]);

    // Replace with a mostly-overlapping set (drop one, add one) and poll the
    // collection mid-flight from a second connection-level read - this
    // should never observe zero documents, unlike the old deleteMany+
    // insertMany pattern which had exactly that window.
    let sawEmpty = false;
    const pollHandle = setInterval(async () => {
        const count = await repo.MemoryModel.countDocuments({ userId }).catch(() => -1);
        if (count === 0) sawEmpty = true;
    }, 1);

    await repo.writeMemories(userId, [
        { id: "a", text: "Alpha", embedding: [1], importance: 5, category: "general" },
        { id: "c", text: "Gamma", embedding: [1], importance: 5, category: "general" }
    ]);

    clearInterval(pollHandle);
    assert.equal(sawEmpty, false, "the collection must never be observed fully empty during a write");
});
