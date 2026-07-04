const test = require("node:test");
const assert = require("node:assert/strict");

const Events = require("../socket/socketEvents");

test("socket event constants expose thinking lifecycle events", () => {
    assert.equal(Events.THINKING_START, "yuna:thinking:start");
    assert.equal(Events.THINKING_END, "yuna:thinking:end");
});
