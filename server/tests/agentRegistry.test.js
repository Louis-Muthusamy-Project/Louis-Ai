const test = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("events");

const BrowserAgent = require("../agents/BrowserAgent");
const CodingAgent = require("../agents/CodingAgent");
const VisionAgent = require("../agents/VisionAgent");
const VoiceAgent = require("../agents/VoiceAgent");
const MemoryAgent = require("../agents/MemoryAgent");
const LearningAgent = require("../agents/LearningAgent");

function makeFakeKernel({ capability } = {}) {
    const eventBus = new EventEmitter();
    return {
        eventBus,
        get(name) {
            if (name === "eventBus") return eventBus;
            if (name === "sharedContext") return { get: () => undefined, set: () => {} };
            if (name === "capabilityRegistry") {
                return { get: (id) => (id === "test.capability" ? capability : undefined) };
            }
            throw new Error(`Unexpected kernel.get(${name}) in test`);
        }
    };
}

function waitForBroadcast(eventBus, topic) {
    return new Promise((resolve) => {
        eventBus.once(topic, resolve);
    });
}

// -------------------------------------------------------------------
// BrowserAgent / CodingAgent - now real generic capability dispatch,
// matching ExecutorAgent/AutomationAgent's already-working pattern.
// -------------------------------------------------------------------

test("BrowserAgent dispatches to a real registered capability instead of throwing 'not implemented yet'", async () => {
    const capability = { execute: async (params) => ({ success: true, echoedParams: params }) };
    const kernel = makeFakeKernel({ capability });
    const agent = new BrowserAgent(kernel);
    await agent.start();

    const completePromise = waitForBroadcast(kernel.eventBus, "agent:task:complete");
    kernel.eventBus.emit("agent:Browser:request", { taskId: "t1", action: "test.capability", params: { url: "https://example.com" } });

    const result = await completePromise;
    assert.equal(result.taskId, "t1");
    assert.equal(result.result.success, true);
    assert.deepEqual(result.result.echoedParams, { url: "https://example.com" });
});

test("BrowserAgent reports a real error (not a fake success) for an unregistered capability", async () => {
    const kernel = makeFakeKernel({});
    const agent = new BrowserAgent(kernel);
    await agent.start();

    const errorPromise = waitForBroadcast(kernel.eventBus, "agent:task:error");
    kernel.eventBus.emit("agent:Browser:request", { taskId: "t2", action: "nonexistent.capability", params: {} });

    const result = await errorPromise;
    assert.match(result.error, /not registered/);
});

test("CodingAgent dispatches to a real registered capability instead of throwing 'not implemented yet'", async () => {
    const capability = { execute: async (params) => ({ success: true, ran: params.command }) };
    const kernel = makeFakeKernel({ capability });
    const agent = new CodingAgent(kernel);
    await agent.start();

    const completePromise = waitForBroadcast(kernel.eventBus, "agent:task:complete");
    kernel.eventBus.emit("agent:Coding:request", { taskId: "t3", action: "test.capability", params: { command: "npm test" } });

    const result = await completePromise;
    assert.equal(result.result.success, true);
    assert.equal(result.result.ran, "npm test");
});

// -------------------------------------------------------------------
// Vision/Voice/Memory/Learning agents - intentionally NOT registered in
// bootstrap.js anymore (nothing real to delegate to), but still return an
// honest, real error if ever invoked directly - never a fake success.
// -------------------------------------------------------------------

for (const [AgentClass, requestTopic] of [
    [VisionAgent, "agent:Vision:request"],
    [VoiceAgent, "agent:Voice:request"],
    [MemoryAgent, "agent:Memory:request"],
    [LearningAgent, "agent:Learning:request"]
]) {
    test(`${AgentClass.name} never fakes success - it reports a real, honest error`, async () => {
        const kernel = makeFakeKernel({});
        const agent = new AgentClass(kernel);
        await agent.start();

        const errorPromise = waitForBroadcast(kernel.eventBus, "agent:task:error");
        kernel.eventBus.emit(requestTopic, { taskId: "tX", action: "whatever" });

        const result = await errorPromise;
        assert.equal(typeof result.error, "string");
        assert.ok(result.error.length > 0);
    });
}

// -------------------------------------------------------------------
// bootstrap.js no longer actively registers the four agents with no
// real capability behind them.
// -------------------------------------------------------------------

test("bootstrap.js no longer registers MemoryAgent/VisionAgent/VoiceAgent/LearningAgent in the active agents list", () => {
    const fs = require("fs");
    const path = require("path");
    const bootstrapSource = fs.readFileSync(path.join(__dirname, "..", "bootstrap.js"), "utf8");

    const agentsListMatch = bootstrapSource.match(/Kernel\.register\("agents",\s*\[([\s\S]*?)\]\)/);
    assert.ok(agentsListMatch, "Could not find the agents registration array in bootstrap.js");

    const agentsListBody = agentsListMatch[1];
    assert.doesNotMatch(agentsListBody, /new MemoryAgent/);
    assert.doesNotMatch(agentsListBody, /new VisionAgent/);
    assert.doesNotMatch(agentsListBody, /new VoiceAgent/);
    assert.doesNotMatch(agentsListBody, /new LearningAgent/);

    // Still real / still registered:
    assert.match(agentsListBody, /new BrowserAgent/);
    assert.match(agentsListBody, /new CodingAgent/);
    assert.match(agentsListBody, /new PlannerAgent/);
    assert.match(agentsListBody, /new ExecutorAgent/);
    assert.match(agentsListBody, /new AutomationAgent/);
});
