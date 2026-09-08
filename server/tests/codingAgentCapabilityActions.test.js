const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const Kernel = require("../core/Kernel");
if (!process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = "test-only-placeholder-not-a-real-key";
if (!Kernel.has("eventBus")) Kernel.register("eventBus", require("../core/EventBus"));
if (!Kernel.has("providerManager")) Kernel.register("providerManager", require("../providers/ProviderManager"));

const { CodingWorkspaceService } = require("../services/codingWorkspaceService");
const capability = require("../capabilities/CodingWorkspaceCapability");
const { CodingAgentRuntime } = require("../services/coding/CodingAgentRuntime");
const CodingModelProvider = require("../services/coding/CodingModelProvider");

function makeWorkspace(userId = "capagentuser") {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-capagent-"));
    const settings = { [userId]: { codingWorkspace: root } };
    Object.defineProperty(CodingWorkspaceService, "settingsService", {
        get() {
            return {
                getSettings: (id) => settings[id] || {},
                updateSettings: (id, v) => { settings[id] = { ...(settings[id] || {}), ...v }; }
            };
        },
        configurable: true
    });
    return root;
}

test("CodingWorkspaceCapability: agent.providers reports Gemini configured and OpenAI/Claude visible-but-disabled", async () => {
    await capability.initialize(Kernel);
    const result = await capability.execute({ action: "agent.providers", params: {}, __ownerId: "capagentuser" });
    assert.equal(result.success, true);
    const gemini = result.providers.find((p) => p.name === "gemini");
    const openai = result.providers.find((p) => p.name === "openai");
    const claude = result.providers.find((p) => p.name === "claude");
    assert.equal(gemini.enabled, true);
    assert.equal(openai.enabled, false);
    assert.ok(openai.reason);
    assert.equal(claude.enabled, false);
    assert.ok(claude.reason);
});

test("CodingWorkspaceCapability: agent.run rejects an unavailable provider (claude) without ever running anything", async () => {
    makeWorkspace();
    await capability.initialize(Kernel);
    const result = await capability.execute({
        action: "agent.run",
        params: { task: "do something", provider: "claude" },
        __ownerId: "capagentuser"
    });
    assert.equal(result.success, false);
    assert.match(result.message, /not available/i);
});

/** A scripted provider, injected via CodingProviderRegistry monkeypatching
 * for this test only, so agent.run's real dispatch path (capability ->
 * CodingAgentRuntime.run) is exercised without a live network call. */
class ScriptedProvider extends CodingModelProvider {
    constructor(script) { super(); this.script = script; this.i = 0; }
    getName() { return "gemini"; }
    isConfigured() { return true; }
    buildInitialHistory(task) { return [{ task }]; }
    async sendTurn() {
        const step = this.script[this.i] || { text: "done" };
        this.i += 1;
        return { functionCalls: (step.calls || []).map((c, idx) => ({ id: `c${idx}`, name: c.name, args: c.args })), text: step.text || "" };
    }
    appendModelTurn(h) { return h; }
    appendFunctionResultsTurn(h) { return h; }
}

test("CodingWorkspaceCapability: agent.run drives a real CodingAgentRuntime run end to end through the capability layer", async () => {
    const root = makeWorkspace();
    await capability.initialize(Kernel);

    const original = capability.providerRegistry.getCodingProvider;
    capability.providerRegistry.getCodingProvider = (name) => {
        assert.equal(name, "gemini");
        return new ScriptedProvider([
            { calls: [{ name: "file_create", args: { path: "via-capability.txt", content: "ok" } }] },
            { text: "created it" }
        ]);
    };

    try {
        const result = await capability.execute({
            action: "agent.run",
            params: { task: "create a file", provider: "gemini" },
            __ownerId: "capagentuser"
        });
        assert.equal(result.success, true);
        assert.equal(result.state, "COMPLETED");
        assert.ok(result.changedFiles.includes("via-capability.txt"));
        assert.equal(fs.readFileSync(path.join(root, "via-capability.txt"), "utf8"), "ok");
    } finally {
        capability.providerRegistry.getCodingProvider = original;
    }
});

test("CodingWorkspaceCapability: agent.cancel forwards to CodingAgentRuntime.cancel", async () => {
    await capability.initialize(Kernel);
    const result = await capability.execute({ action: "agent.cancel", params: { sessionId: "not-a-real-session" }, __ownerId: "capagentuser" });
    assert.equal(result.success, true);
    assert.equal(result.cancelled, false); // unknown/finished session -> false, but call itself succeeds
});
