const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { CodingWorkspaceService } = require("../services/codingWorkspaceService");
const { CodingAgentRuntime, STATES } = require("../services/coding/CodingAgentRuntime");
const OpenAICodingProvider = require("../services/coding/OpenAICodingProvider");
const ClaudeCodingProvider = require("../services/coding/ClaudeCodingProvider");
const { CODING_TOOLS } = require("../services/coding/codingToolDefinitions");

function makeWorkspace(userId) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yuna-multiprov-"));
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

// ---- OpenAI (Responses API) ------------------------------------------------

test("OpenAICodingProvider: sends instructions/input/tools in the real Responses API shape", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    let captured = null;
    const fakeRawProvider = {
        generateWithTools: async (instructions, input, tools) => {
            captured = { instructions, input, tools };
            return { output: [], output_text: "done" };
        }
    };
    const provider = new OpenAICodingProvider(fakeRawProvider);
    assert.equal(provider.isConfigured(), true);

    const history = provider.buildInitialHistory("fix the bug", "You are a coding agent.");
    assert.deepEqual(history.input, [{ role: "user", content: "fix the bug" }]);
    assert.equal(history.instructions, "You are a coding agent.");

    await provider.sendTurn(history, CODING_TOOLS);
    assert.equal(captured.instructions, "You are a coding agent.");
    assert.deepEqual(captured.input, history.input);
    // The adapter passes plain JSON-schema tool defs straight through - the
    // conversion to OpenAI's {type:'function', name, parameters, strict}
    // wire shape happens inside OpenAIProvider.generateWithTools itself
    // (tested separately below against the real SDK type shape), not here.
    assert.equal(captured.tools, CODING_TOOLS);
});

test("OpenAICodingProvider: parses a real-shaped function_call output item into a normalized call", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fakeRawProvider = {
        generateWithTools: async () => ({
            output: [
                {
                    type: "function_call",
                    call_id: "call_abc123",
                    name: "file_read",
                    arguments: JSON.stringify({ path: "src/App.jsx" })
                }
            ],
            output_text: ""
        })
    };
    const provider = new OpenAICodingProvider(fakeRawProvider);
    const history = provider.buildInitialHistory("read a file", "sys");
    const turn = await provider.sendTurn(history, CODING_TOOLS);

    assert.equal(turn.functionCalls.length, 1);
    assert.equal(turn.functionCalls[0].id, "call_abc123");
    assert.equal(turn.functionCalls[0].name, "file_read");
    assert.deepEqual(turn.functionCalls[0].args, { path: "src/App.jsx" });
});

test("OpenAICodingProvider: appendModelTurn replays real output items in order, appendFunctionResultsTurn appends function_call_output items", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const outputItem = { type: "function_call", call_id: "call_1", name: "workspace_inspect", arguments: "{}" };
    const fakeRawProvider = { generateWithTools: async () => ({ output: [outputItem], output_text: "" }) };
    const provider = new OpenAICodingProvider(fakeRawProvider);

    let history = provider.buildInitialHistory("task", "sys");
    const turn = await provider.sendTurn(history, CODING_TOOLS);
    history = provider.appendModelTurn(history);
    assert.deepEqual(history.input[history.input.length - 1], outputItem);

    history = provider.appendFunctionResultsTurn(history, [{ call: turn.functionCalls[0], result: { success: true, root: "/ws" } }]);
    const last = history.input[history.input.length - 1];
    assert.equal(last.type, "function_call_output");
    assert.equal(last.call_id, "call_1");
    assert.deepEqual(JSON.parse(last.output), { success: true, root: "/ws" });
});

test("OpenAICodingProvider: full agent loop via CodingAgentRuntime actually writes a real file", async () => {
    const root = makeWorkspace("openaiuser");
    process.env.OPENAI_API_KEY = "test-key";

    let call = 0;
    const fakeRawProvider = {
        generateWithTools: async () => {
            call += 1;
            if (call === 1) {
                return {
                    output: [{ type: "function_call", call_id: "c1", name: "file_create", arguments: JSON.stringify({ path: "openai-agent.txt", content: "made by openai adapter" }) }],
                    output_text: ""
                };
            }
            return { output: [], output_text: "created the file" };
        }
    };
    const provider = new OpenAICodingProvider(fakeRawProvider);

    const EventEmitter = require("events");
    CodingAgentRuntime.initialize(new EventEmitter());
    const result = await CodingAgentRuntime.run("openaiuser", "create a file", provider);

    assert.equal(result.state, STATES.COMPLETED);
    assert.equal(fs.readFileSync(path.join(root, "openai-agent.txt"), "utf8"), "made by openai adapter");
});

// ---- Claude (Messages API) -------------------------------------------------

test("ClaudeCodingProvider: sends system/messages/tools in the real Messages API shape", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    let captured = null;
    const fakeRawProvider = {
        generateWithTools: async (system, messages, tools) => {
            captured = { system, messages, tools };
            return { content: [{ type: "text", text: "done" }] };
        }
    };
    const provider = new ClaudeCodingProvider(fakeRawProvider);
    assert.equal(provider.isConfigured(), true);

    const history = provider.buildInitialHistory("fix the bug", "You are a coding agent.");
    assert.deepEqual(history.messages, [{ role: "user", content: "fix the bug" }]);

    await provider.sendTurn(history, CODING_TOOLS);
    assert.equal(captured.system, "You are a coding agent.");
    // Same as OpenAI above - the adapter passes plain tool defs through;
    // the input_schema conversion happens inside AnthropicProvider.generateWithTools.
    assert.equal(captured.tools, CODING_TOOLS);
});

test("ClaudeCodingProvider: parses a real-shaped tool_use block into a normalized call, and text blocks into text", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const fakeRawProvider = {
        generateWithTools: async () => ({
            content: [
                { type: "text", text: "Let me check that file." },
                { type: "tool_use", id: "toolu_01ABC", name: "file_read", input: { path: "src/App.jsx" } }
            ]
        })
    };
    const provider = new ClaudeCodingProvider(fakeRawProvider);
    const history = provider.buildInitialHistory("read a file", "sys");
    const turn = await provider.sendTurn(history, CODING_TOOLS);

    assert.equal(turn.text, "Let me check that file.");
    assert.equal(turn.functionCalls.length, 1);
    assert.equal(turn.functionCalls[0].id, "toolu_01ABC");
    assert.equal(turn.functionCalls[0].name, "file_read");
    assert.deepEqual(turn.functionCalls[0].args, { path: "src/App.jsx" });
});

test("ClaudeCodingProvider: batches multiple tool results from one turn into a single user message with tool_result blocks", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const content = [
        { type: "tool_use", id: "t1", name: "file_read", input: { path: "a.js" } },
        { type: "tool_use", id: "t2", name: "file_read", input: { path: "b.js" } }
    ];
    const fakeRawProvider = { generateWithTools: async () => ({ content }) };
    const provider = new ClaudeCodingProvider(fakeRawProvider);

    let history = provider.buildInitialHistory("task", "sys");
    const turn = await provider.sendTurn(history, CODING_TOOLS);
    history = provider.appendModelTurn(history);
    assert.deepEqual(history.messages[history.messages.length - 1], { role: "assistant", content });

    history = provider.appendFunctionResultsTurn(history, [
        { call: turn.functionCalls[0], result: { success: true, content: "a" } },
        { call: turn.functionCalls[1], result: { success: true, content: "b" } }
    ]);
    const last = history.messages[history.messages.length - 1];
    assert.equal(last.role, "user");
    assert.equal(last.content.length, 2);
    assert.equal(last.content[0].type, "tool_result");
    assert.equal(last.content[0].tool_use_id, "t1");
    assert.equal(last.content[0].is_error, false);
});

test("ClaudeCodingProvider: marks a failed tool result as is_error:true", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const fakeRawProvider = { generateWithTools: async () => ({ content: [{ type: "tool_use", id: "t1", name: "file_read", input: {} }] }) };
    const provider = new ClaudeCodingProvider(fakeRawProvider);
    let history = provider.buildInitialHistory("task", "sys");
    const turn = await provider.sendTurn(history, CODING_TOOLS);
    history = provider.appendModelTurn(history);
    history = provider.appendFunctionResultsTurn(history, [{ call: turn.functionCalls[0], result: { success: false, message: "not found" } }]);
    assert.equal(history.messages[history.messages.length - 1].content[0].is_error, true);
});

test("ClaudeCodingProvider: full agent loop via CodingAgentRuntime actually writes a real file", async () => {
    const root = makeWorkspace("claudeuser");
    process.env.ANTHROPIC_API_KEY = "test-key";

    let call = 0;
    const fakeRawProvider = {
        generateWithTools: async () => {
            call += 1;
            if (call === 1) {
                return { content: [{ type: "tool_use", id: "t1", name: "file_create", input: { path: "claude-agent.txt", content: "made by claude adapter" } }] };
            }
            return { content: [{ type: "text", text: "created the file" }] };
        }
    };
    const provider = new ClaudeCodingProvider(fakeRawProvider);

    const EventEmitter = require("events");
    CodingAgentRuntime.initialize(new EventEmitter());
    const result = await CodingAgentRuntime.run("claudeuser", "create a file", provider);

    assert.equal(result.state, STATES.COMPLETED);
    assert.equal(fs.readFileSync(path.join(root, "claude-agent.txt"), "utf8"), "made by claude adapter");
});

test("OpenAIProvider (raw): converts plain tool defs to the real FunctionTool wire shape before calling the SDK", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const OpenAIProvider = require("../providers/OpenAIProvider");
    const provider = new OpenAIProvider();
    let captured = null;
    provider.client = { responses: { create: async (req) => { captured = req; return { output: [], output_text: "ok" }; } } };

    await provider.generateWithTools("sys", [{ role: "user", content: "hi" }], CODING_TOOLS);

    assert.ok(Array.isArray(captured.tools));
    for (const t of captured.tools) {
        assert.equal(t.type, "function");
        assert.equal(typeof t.name, "string");
        assert.equal(typeof t.parameters, "object");
    }
    assert.equal(captured.instructions, "sys");
    assert.equal(captured.tool_choice, "auto");
});

test("AnthropicProvider (raw): converts plain tool defs to the real Tool wire shape (input_schema, not parameters) before calling the SDK", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const AnthropicProvider = require("../providers/AnthropicProvider");
    const provider = new AnthropicProvider();
    let captured = null;
    provider.client = { messages: { create: async (req) => { captured = req; return { content: [{ type: "text", text: "ok" }] }; } } };

    await provider.generateWithTools("sys", [{ role: "user", content: "hi" }], CODING_TOOLS);

    assert.ok(Array.isArray(captured.tools));
    for (const t of captured.tools) {
        assert.equal(typeof t.name, "string");
        assert.equal(typeof t.input_schema, "object");
        assert.equal(t.parameters, undefined);
    }
    assert.equal(captured.system, "sys");
    assert.ok(captured.max_tokens > 0);
});

test("ProviderManager: registers OpenAI/Claude only when their API keys are present, and never crashes app startup when they're absent", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    if (!process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = "test-only-placeholder";

    delete require.cache[require.resolve("../providers/ProviderManager")];
    const ProviderManager = require("../providers/ProviderManager");
    const manager = new ProviderManager({}); // no real Kernel methods needed by GeminiProvider's constructor path here

    assert.ok(manager.getRawProvider("gemini"));
    assert.equal(manager.getRawProvider("openai"), null);
    assert.equal(manager.getRawProvider("claude"), null);

    process.env.OPENAI_API_KEY = "test-key";
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete require.cache[require.resolve("../providers/ProviderManager")];
    const ProviderManager2 = require("../providers/ProviderManager");
    const manager2 = new ProviderManager2({});
    assert.ok(manager2.getRawProvider("openai"));
    assert.ok(manager2.getRawProvider("claude"));
});

test("CodingAgentRuntime: zero provider-specific branching - the exact same runtime code path drives OpenAI, Claude, and (from other test files) Gemini", () => {
    // This is a structural assertion, not a new behavior test: the fact
    // that the two "full agent loop" tests above call the SAME
    // CodingAgentRuntime.run() with no provider-name checks anywhere in
    // CodingAgentRuntime.js (verified by inspection - grep confirms no
    // "getName() ===" branching exists there) is the actual proof the
    // architecture requirement is met.
    const source = require("fs").readFileSync(
        require("path").join(__dirname, "../services/coding/CodingAgentRuntime.js"),
        "utf8"
    );
    assert.doesNotMatch(source, /getName\(\)\s*===/);
    assert.doesNotMatch(source, /provider\.getName\(\)\s*==\s*["']gemini["']/);
});
