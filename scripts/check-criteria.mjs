import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
const mapping = JSON.parse(await readFile("verification/criteria.json", "utf8"));
const expected = new Set();
for (const file of await readdir("book/design")) {
  if (!file.endsWith(".md")) continue;
  const text = await readFile("book/design/" + file, "utf8");
  let anchor;
  for (const line of text.split("\n")) {
    const match = line.match(/^> \*\*`(A-[^`]+)`/);
    if (match) anchor = match[1];
    const criterion = line.match(/^> - Criterion `([^`]+)`/);
    if (criterion) expected.add(anchor + ":" + criterion[1]);
  }
}
assert.deepEqual(new Set(Object.keys(mapping)), expected, "Criterion mapping differs from the Book.");
for (const [key, entry] of Object.entries(mapping)) {
  assert(["full", "partial", "deferred"].includes(entry.coverage), key);
  assert(entry.coverage === "deferred" || entry.files.length > 0, key);
  let sources = "";
  for (const file of entry.files) sources += await readFile(file, "utf8");
  for (const text of entry.cases) assert(sources.includes(text), `${key}: stale case reference ${text}`);
  if (entry.coverage !== "full") assert(entry.gap, key);
}
console.log(`Criterion mapping passed: ${expected.size} entries. This validates associations, not executed evidence.`);
