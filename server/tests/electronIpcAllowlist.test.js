const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const preloadSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "electron", "preload.js"),
    "utf8"
);

function extractSet(varName) {
    const match = preloadSrc.match(new RegExp(`const ${varName} = new Set\\(\\[([\\s\\S]*?)\\]\\)`));
    assert.ok(match, `could not find ${varName} in preload.js`);
    return [...match[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
}

test("preload.js: invoke() is gated by an explicit allowlist, not open to any channel", () => {
    assert.match(preloadSrc, /ALLOWED_INVOKE_CHANNELS\.has\(channel\)/);
    assert.match(preloadSrc, /Channel not allowed/);
});

test("preload.js: every channel the app actually uses (system:info, window:*, automation:*) is allowlisted", () => {
    const allowed = extractSet("ALLOWED_INVOKE_CHANNELS");
    const expected = [
        "system:info",
        "system:getSources",
        "window:minimize",
        "window:maximize",
        "window:close",
        "automation:clipboard:read",
        "automation:clipboard:write",
        "automation:notification:send",
        "automation:recycle:trashItem",
        "automation:shell:open"
    ];
    for (const channel of expected) {
        assert.ok(allowed.includes(channel), `${channel} should be allowlisted`);
    }
});

test("preload.js: an arbitrary/unknown channel is NOT in the allowlist", () => {
    const allowed = extractSet("ALLOWED_INVOKE_CHANNELS");
    assert.ok(!allowed.includes("shell:exec"));
    assert.ok(!allowed.includes("fs:readFile"));
    assert.ok(!allowed.includes("process:env"));
});

test("preload.js: on() is also gated by an allowlist, not open to any channel", () => {
    assert.match(preloadSrc, /ALLOWED_LISTEN_CHANNELS\.has\(channel\)/);
});
