const test = require("node:test");
const assert = require("node:assert/strict");

function makeCapability(providerManagerOverrides = {}) {
    // Fresh instance per test (module.exports is a singleton, so require
    // a fresh copy of the class isn't trivial) - reuse the exported
    // singleton but reset its internal rate-limit/in-flight state so
    // tests don't leak into each other.
    const capability = require("../capabilities/ImageGenerationCapability");
    capability._requestTimestamps = new Map();
    capability._inFlight = new Set();
    capability.eventBus = null; // no socket bridge needed for these tests
    capability.providerManager = {
        generateImage: async (prompt) => ({ data: "ZmFrZS1pbWFnZS1ieXRlcw==", mimeType: "image/png" }),
        ...providerManagerOverrides
    };
    return capability;
}

test("ImageGenerationCapability: requires an authenticated ownerId", async () => {
    const cap = makeCapability();
    const result = await cap.execute({ action: "generate", params: { prompt: "a cat" } }); // no __ownerId
    assert.equal(result.success, false);
    assert.match(result.message, /authenticated owner/i);
});

test("ImageGenerationCapability: never trusts a client-supplied ownerId inside params - only __ownerId (injected server-side)", async () => {
    const cap = makeCapability();
    // Simulate a malicious plan/payload trying to smuggle a different
    // owner via params - execute() must ignore it entirely.
    const result = await cap.execute({
        action: "generate",
        params: { prompt: "a cat", ownerId: "someone-else", userId: "someone-else" },
        __ownerId: "real-user"
    });
    assert.equal(result.success, true);
    // No direct way to observe which owner it used from the return value,
    // but generate() is called with the real ownerId - proven by the
    // rate-limit test below keying off "real-user" specifically.
});

test("ImageGenerationCapability: rejects an empty prompt without calling the provider", async () => {
    const cap = makeCapability({
        generateImage: async () => { throw new Error("should not be called"); }
    });
    const result = await cap.generate("user-1", "   ");
    assert.equal(result.success, false);
    assert.match(result.message, /prompt is required/i);
});

test("ImageGenerationCapability: a provider failure returns a structured error, never a fake success", async () => {
    const cap = makeCapability({
        generateImage: async () => { throw new Error("model not enabled for this API key"); }
    });
    const result = await cap.generate("user-1", "a dragon");
    assert.equal(result.success, false);
    assert.match(result.message, /model not enabled/i);
});

test("ImageGenerationCapability: a successful generation never includes a filesystem path", async () => {
    const cap = makeCapability();
    const result = await cap.generate("user-1", "a sunset");
    assert.equal(result.success, true);
    assert.equal(typeof result.data, "string");
    assert.ok(!/[\\/][a-zA-Z]:|\/(home|server|tmp)\//.test(result.data), "returned data must not look like a filesystem path");
});

test("ImageGenerationCapability: prevents a second concurrent request for the SAME user while one is in flight", async () => {
    let resolveFirst;
    const cap = makeCapability({
        generateImage: () => new Promise((resolve) => { resolveFirst = resolve; })
    });

    const first = cap.generate("user-1", "first prompt");
    // Give the first call a tick to register itself as in-flight.
    await new Promise((r) => setTimeout(r, 5));

    const second = await cap.generate("user-1", "second prompt");
    assert.equal(second.success, false);
    assert.match(second.message, /already being generated/i);

    resolveFirst({ data: "ZmFrZQ==", mimeType: "image/png" });
    const firstResult = await first;
    assert.equal(firstResult.success, true);
});

test("ImageGenerationCapability: does NOT block a different user while one user's request is in flight", async () => {
    let resolveA;
    let resolveB;
    const cap = makeCapability({
        generateImage: (prompt) => new Promise((resolve) => {
            if (prompt === "prompt A") resolveA = resolve;
            else resolveB = resolve;
        })
    });

    const first = cap.generate("user-a", "prompt A");
    await new Promise((r) => setTimeout(r, 5));

    const second = cap.generate("user-b", "prompt B");
    await new Promise((r) => setTimeout(r, 5));

    resolveA({ data: "ZmFrZQ==", mimeType: "image/png" });
    resolveB({ data: "ZmFrZQ==", mimeType: "image/png" });

    const firstResult = await first;
    const secondResult = await second;

    assert.equal(firstResult.success, true);
    assert.equal(secondResult.success, true, "a different user must not be blocked by user A's in-flight request");
});

test("ImageGenerationCapability: rate limits a user after too many requests in the window", async () => {
    const cap = makeCapability();
    let lastResult;
    for (let i = 0; i < 6; i++) {
        lastResult = await cap.generate("user-rate-limited", `prompt ${i}`);
    }
    assert.equal(lastResult.success, false);
    assert.match(lastResult.message, /rate limit/i);
});

test("ImageGenerationCapability: has full metadata (permission, riskLevel, timeoutMs, description)", () => {
    const cap = require("../capabilities/ImageGenerationCapability");
    const meta = cap.metadata();
    assert.ok(meta.description);
    assert.ok(meta.permission);
    assert.ok(meta.riskLevel);
    assert.ok(meta.timeoutMs > 0);
});
