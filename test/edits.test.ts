import test from "node:test";
import assert from "node:assert/strict";
import { compileEdits, decodeOperation } from "../src/edits.js";
import { noteSelector, snapshot, serviceUrl, configFromEnv } from "../src/core.js";
import { applyWire } from "./fixture.js";

test("A-notes-precise-edits: independent exact/UTF-16 expectations", () => {
  const cases: [string, { old_text: string; new_text: string }[], string][] = [
    ["Hello world", [{ old_text: "world", new_text: "HedgeDoc" }], "Hello HedgeDoc"],
    ["---\r\ntitle: 😀\r\n---\r\ncafe\u0301 👩‍💻\r\n", [{ old_text: "😀", new_text: "🌍" }, { old_text: "cafe\u0301", new_text: "tea" }], "---\r\ntitle: 🌍\r\n---\r\ntea 👩‍💻\r\n"],
    ["abcDEFghi", [{ old_text: "DEF", new_text: "" }], "abcghi"],
    ["abc", [{ old_text: "b", new_text: "bX" }], "abXc"],
    ["", [{ old_text: "", new_text: "😀" }], "😀"],
    ["a\0bc", [{ old_text: "bc", new_text: "BC" }], "a\0BC"],
    ["abc", [{ old_text: "ab", new_text: "X" }, { old_text: "c", new_text: "Y" }], "XY"],
  ];
  for (const [base, replacements, expected] of cases) {
    const op = compileEdits(base, replacements, 10000);
    assert.equal(op.baseLength, base.length);
    assert.equal(op.apply(base), expected);
    assert.equal(applyWire(base, op.toJSON()), expected);
  }
  assert.deepEqual(compileEdits("😀", [{ old_text: "😀", new_text: "X" }], 100).toJSON(), ["X", -2]);
  assert.deepEqual(compileEdits("abc", [{ old_text: "abc", new_text: "abXc" }], 100).toJSON(), [2, "X", 1]);
  assert.deepEqual(compileEdits("😀", [{ old_text: "😀", new_text: "😁" }], 100).toJSON(), ["😁", -2]);
  assert(compileEdits("abc", [{ old_text: "b", new_text: "b" }], 100).isNoop());
});

test("A-notes-precise-edits: invalid batches cannot compile", () => {
  const invalid = [
    [], [{ old_text: "missing", new_text: "X" }], [{ old_text: "a", new_text: "X" }],
    [{ old_text: "ab", new_text: "X" }, { old_text: "ba", new_text: "Y" }],
    [{ old_text: "", new_text: "X" }], [{ old_text: "b", new_text: "\0" }],
    [{ old_text: "b", new_text: "\ud800" }], [{ old_text: "\ud800", new_text: "" }],
  ];
  for (const edits of invalid) assert.throws(() => compileEdits("aba", edits, 100));
  assert.throws(() => compileEdits("b", [{ old_text: "b", new_text: "x".repeat(1000) }], 100));
  assert.throws(() => decodeOperation([1, "X", 1], "😀", 100));
  assert.throws(() => decodeOperation([0], "", 100));
});

test("A-notes-precise-edits: generated Unicode preservation, independent wire oracle", () => {
  for (let i = 0; i < 500; i++) {
    const before = "😀\r\n".repeat(i % 7), after = "e\u0301💻".repeat(i % 11);
    const op = compileEdits(before + "UNIQUE" + after, [{ old_text: "UNIQUE", new_text: "new🌍" }], 10000);
    assert.equal(applyWire(before + "UNIQUE" + after, op.toJSON()), before + "new🌍" + after);
  }
});

test("A-service-contained-requests and snapshot-provenance: selectors and scope", () => {
  for (const bad of ["../x", "%2f", "https://elsewhere/x", "/s/id", "a/b", "a\\b", "..", "\0"])
    assert.throws(() => noteSelector(bad));
  assert.equal(noteSelector("café alias"), "café alias");
});

test("A-notes-faithful-content: snapshot binds origin, prefix, selector, exact content", () => {
  const a = configFromEnv({ HOGLET_SERVICE: "http://localhost/pad" });
  const b = { ...a, service: serviceUrl("http://localhost/other") };
  const token = snapshot(a, "one", "same");
  assert.notEqual(token, snapshot(a, "two", "same"));
  assert.notEqual(token, snapshot(b, "one", "same"));
  assert.notEqual(token, snapshot(a, "one", "same\r\n"));
  assert.equal(token, snapshot(a, "one", "same"));
});
