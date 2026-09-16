import test from "node:test";
import assert from "node:assert/strict";

import { matchWakePhrase, normalize, WakeCooldown } from "./wakePhraseMatcher.js";

test("matchWakePhrase: matches 'Hey Yuna' at the start of a full sentence", () => {
    const result = matchWakePhrase("Hey Yuna, what's the weather today?");
    assert.equal(result.id, "hey-yuna");
});

test("matchWakePhrase: matches common mis-transcriptions of 'Hey Yuna'", () => {
    assert.equal(matchWakePhrase("hey yoona can you help").id, "hey-yuna");
    assert.equal(matchWakePhrase("hi yuna open the terminal").id, "hey-yuna");
});

test("matchWakePhrase: matches 'Thangapila' and its likely mis-transcription variants", () => {
    assert.equal(matchWakePhrase("Thangapila generate an image").id, "thangapila");
    assert.equal(matchWakePhrase("thanga pila can you help").id, "thangapila");
    assert.equal(matchWakePhrase("thankapila open chat").id, "thangapila");
});

test("matchWakePhrase: is case/punctuation/diacritic insensitive", () => {
    assert.equal(matchWakePhrase("HEY, YUNA!!").id, "hey-yuna");
    assert.equal(matchWakePhrase("héy yúna").id, "hey-yuna");
});

test("matchWakePhrase: returns null for unrelated speech", () => {
    assert.equal(matchWakePhrase("what time is it in tokyo"), null);
    assert.equal(matchWakePhrase(""), null);
    assert.equal(matchWakePhrase(null), null);
});

test("matchWakePhrase: never matches on a bare substring that isn't a real variant", () => {
    // "yuna" alone or "pila" alone must NOT trigger - only a configured
    // full variant should, or every mention of the character's name in
    // normal chat would fire the popup.
    assert.equal(matchWakePhrase("I love the character Yuna"), null);
    assert.equal(matchWakePhrase("pila is a word"), null);
});

test("normalize: strips punctuation, case, and collapses whitespace", () => {
    assert.equal(normalize("  Hey,   Yuna!!  "), "hey yuna");
});

test("WakeCooldown: blocks a second trigger within the cooldown window", () => {
    const cooldown = new WakeCooldown(3000);
    assert.equal(cooldown.tryTrigger(1000), true);
    assert.equal(cooldown.tryTrigger(1500), false); // 500ms later - still cooling down
    assert.equal(cooldown.tryTrigger(3999), false); // 2999ms later - still within window
});

test("WakeCooldown: allows a trigger again once the cooldown has elapsed", () => {
    const cooldown = new WakeCooldown(3000);
    assert.equal(cooldown.tryTrigger(1000), true);
    assert.equal(cooldown.tryTrigger(4001), true); // 3001ms later - cooldown elapsed
});

test("WakeCooldown: reset() allows an immediate trigger regardless of timing", () => {
    const cooldown = new WakeCooldown(3000);
    assert.equal(cooldown.tryTrigger(1000), true);
    cooldown.reset();
    assert.equal(cooldown.tryTrigger(1050), true);
});
