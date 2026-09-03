const test = require("node:test");
const assert = require("node:assert/strict");

const PluginSandbox = require("../core/PluginSandbox");

function run(scriptBody, manifest) {
    const sandbox = new PluginSandbox({ get: () => null });
    return sandbox.evaluate(
        `
        class TestPlugin {
            onEnable() {}
            constructor(context) { this.context = context; ${scriptBody} }
        }
        module.exports = TestPlugin;
        `,
        manifest
    );
}

test("PluginSandbox: a plugin without the 'fs' scope cannot require('fs')", () => {
    assert.throws(() => {
        run(`require("fs");`, { name: "evil", scopes: [] });
    }, /fs.*scope/i);
});

test("PluginSandbox: 'node:fs' prefix cannot bypass the fs scope gate", () => {
    assert.throws(() => {
        run(`require("node:fs");`, { name: "evil", scopes: [] });
    }, /fs.*scope/i);
});

test("PluginSandbox: an arbitrary third-party package (not an allowlisted built-in) is rejected outright", () => {
    assert.throws(() => {
        run(`require("puppeteer");`, { name: "evil", scopes: ["fs", "network", "child_process"] });
    }, /not permitted/i);
});

test("PluginSandbox: a plugin WITH the 'fs' scope can require('fs')", () => {
    assert.doesNotThrow(() => {
        run(`require("fs");`, { name: "good", scopes: ["fs"] });
    });
});

test("PluginSandbox: always-safe built-ins (path, crypto, ...) work without any scope", () => {
    assert.doesNotThrow(() => {
        run(`require("path"); require("crypto");`, { name: "good", scopes: [] });
    });
});

test("PluginSandbox: @yuna/sdk is always requireable", () => {
    assert.doesNotThrow(() => {
        run(`const { YunaPlugin } = require("@yuna/sdk"); if (!YunaPlugin) throw new Error("sdk missing");`, { name: "good", scopes: [] });
    });
});

// ── Kernel scoping (context.kernel is now a ScopedKernelFacade, not the raw Kernel) ──

function fakeKernel() {
    const services = {
        memoryService: { tag: "memoryService" },
        scheduleService: { tag: "scheduleService" },
        userRepository: { tag: "userRepository" } // deliberately never in any scope's allowlist
    };
    return { get: (name) => services[name] };
}

test("PluginSandbox: kernel.get() for a service outside every declared scope throws", () => {
    const sandbox = new PluginSandbox(fakeKernel());
    const instance = sandbox.evaluate(
        `
        class TestPlugin {
            onEnable() {}
            constructor(context) { this.context = context; }
            tryIt() { return this.context.kernel.get("memoryService"); }
        }
        module.exports = TestPlugin;
        `,
        { name: "evil", scopes: [] } // no scopes declared at all
    );
    assert.throws(() => instance.tryIt(), /without a declared scope/i);
});

test("PluginSandbox: kernel.get() for a service covered by a declared scope succeeds", () => {
    const sandbox = new PluginSandbox(fakeKernel());
    const instance = sandbox.evaluate(
        `
        class TestPlugin {
            onEnable() {}
            constructor(context) { this.context = context; }
            tryIt() { return this.context.kernel.get("memoryService"); }
        }
        module.exports = TestPlugin;
        `,
        { name: "good", scopes: ["memory"] }
    );
    assert.equal(instance.tryIt().tag, "memoryService");
});

test("PluginSandbox: kernel.get() for a service that ISN'T in any scope's allowlist always throws, even with unrelated scopes declared", () => {
    const sandbox = new PluginSandbox(fakeKernel());
    const instance = sandbox.evaluate(
        `
        class TestPlugin {
            onEnable() {}
            constructor(context) { this.context = context; }
            tryIt() { return this.context.kernel.get("userRepository"); }
        }
        module.exports = TestPlugin;
        `,
        { name: "evil", scopes: ["memory", "schedule", "events", "tools"] }
    );
    assert.throws(() => instance.tryIt(), /without a declared scope/i);
});

test("PluginSandbox: context.kernel is never the raw Kernel instance", () => {
    const kernel = fakeKernel();
    const sandbox = new PluginSandbox(kernel);
    const instance = sandbox.evaluate(
        `
        class TestPlugin {
            onEnable() {}
            constructor(context) { this.context = context; }
            isRawKernel() { return this.context.kernel === undefined; }
        }
        module.exports = TestPlugin;
        `,
        { name: "good", scopes: [] }
    );
    // We can't reference the outer `kernel` object from inside the vm context
    // directly, but we CAN confirm the facade only exposes get() - not the
    // raw kernel's other internals (e.g. a raw Kernel here would have no
    // `.get` restriction at all, which the earlier two tests already prove).
    assert.equal(typeof instance.context.kernel.get, "function");
    assert.notEqual(instance.context.kernel, kernel);
});
