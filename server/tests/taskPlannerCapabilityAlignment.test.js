const test = require("node:test");
const assert = require("node:assert/strict");

const TaskPlanner = require("../services/taskPlanner");
const registry = require("../core/CapabilityRegistry");

// Ensure the real capabilities are registered (mirrors PluginLoader's
// auto-discovery, done manually here since this test doesn't boot the
// full app).
for (const file of ["BrowserCapability", "CodingCapability", "MemoryCapability", "ScheduleCapability", "ImageGenerationCapability"]) {
    const cap = require(`../capabilities/${file}`);
    if (!registry.get(cap.id)) registry.register(cap);
}

test("taskPlanner: the 'system.time' fast-path no longer points at an unregistered capability", async () => {
    const planner = new TaskPlanner({ get: () => null });
    const plan = await planner.plan({}, { intent: "system", parameters: { command: "time" }, requiresTool: true });
    assert.deepEqual(plan.steps, [], "should degrade to a direct conversational reply, not a dead capability call");
});

test("taskPlanner: conversation/question intents never produce a plan step", async () => {
    const planner = new TaskPlanner({ get: () => null });
    const p1 = await planner.plan({}, { intent: "conversation", parameters: {}, requiresTool: false });
    const p2 = await planner.plan({}, { intent: "question", parameters: {}, requiresTool: true });
    assert.deepEqual(p1.steps, []);
    assert.deepEqual(p2.steps, []);
});

test("taskPlanner's prompt only advertises capability ids that are ACTUALLY registered in CapabilityRegistry", async () => {
    let capturedPrompt = null;
    const fakeProviderManager = {
        generate: async (contents) => {
            capturedPrompt = contents[0].parts[0].text;
            return JSON.stringify({ steps: [{ capability: "browser", args: { action: "search", params: { query: "test" } } }] });
        }
    };
    const planner = new TaskPlanner({ get: (name) => (name === "providerManager" ? fakeProviderManager : null) });

    await planner.plan({}, { intent: "browser", parameters: {}, requiresTool: true });

    assert.ok(capturedPrompt, "the LLM prompt should have been built");

    // Every capability id quoted in the prompt as an available option must
    // correspond to something actually registered - this is exactly the
    // mismatch that was previously present (dotted names like
    // "browser.navigate" that don't match the registered id "browser").
    const advertisedIds = [...capturedPrompt.matchAll(/^- "(\w+)":/gm)].map(m => m[1]);
    assert.ok(advertisedIds.length > 0, "should have found at least one advertised capability id");

    for (const id of advertisedIds) {
        assert.ok(registry.get(id), `taskPlanner advertises capability "${id}" but it is not registered in CapabilityRegistry`);
    }
});

test("taskPlanner: does not advertise 'memory' or 'desktop' as plan-driven capabilities (neither has real, working plan-driven actions)", async () => {
    let capturedPrompt = null;
    const fakeProviderManager = {
        generate: async (contents) => {
            capturedPrompt = contents[0].parts[0].text;
            return JSON.stringify({ steps: [] });
        }
    };
    const planner = new TaskPlanner({ get: (name) => (name === "providerManager" ? fakeProviderManager : null) });

    await planner.plan({}, { intent: "memory", parameters: {}, requiresTool: true });

    assert.ok(capturedPrompt);
    assert.ok(!/^- "memory":/m.test(capturedPrompt), "memory has no real plan-driven actions and should not be advertised");
    assert.ok(!/^- "desktop":/m.test(capturedPrompt), "no desktop-launch capability is registered - should not be advertised");
});
