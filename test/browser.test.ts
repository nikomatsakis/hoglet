import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { browserLogin, importBrowserCredential } from "../src/login.js";
import { Session } from "../src/session.js";
import { Fixture } from "./fixture.js";

test("browser-assisted provisioning: actual Chromium flow and minimal credential export", {
  skip: process.env.HOGLET_BROWSER_TEST !== "1",
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-browser-"));
  const f = new Fixture("1.10.3"); await f.start(join(directory, "session.json"));
  try {
    const me = await browserLogin(f.config, undefined, { headless: true });
    assert.deepEqual(me, { id: "user-1", name: "Synthetic user" });
    assert.equal(JSON.parse(await readFile(f.config.sessionFile, "utf8")).user_id, "user-1");
    assert.equal((await stat(f.config.sessionFile)).mode & 0o777, 0o600);
    const loaded = new Session(f.config);
    await loaded.load();
    assert.equal(loaded.userId, "user-1");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    try {
      await context.addCookies([
        { name: "connect.sid", value: "SYNTHETIC-HD", url: f.config.service.href },
        { name: "github-token", value: "SYNTHETIC-GH-DO-NOT-EXPORT", url: f.config.service.href },
        { name: "unrelated", value: "SYNTHETIC-OTHER", url: "http://example.test" },
      ]);
      const session = new Session(f.config);
      assert.equal(await importBrowserCredential(context, session), true);
      assert.equal(session.userId, undefined);
      session.userId = "user-1";
      await session.save();
      const text = await readFile(f.config.sessionFile, "utf8");
      assert(!text.includes("SYNTHETIC-GH")); assert(!text.includes("SYNTHETIC-OTHER"));
      assert.equal(JSON.parse(text).cookies.length, 1);
    } finally { await context.close(); await browser.close(); }
  } finally { await f.close(); await rm(directory, { recursive: true, force: true }); }
});

test("browser-assisted expected identity: matching login succeeds, wrong user preserves saved session", {
  skip: process.env.HOGLET_BROWSER_TEST !== "1",
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-browser-"));
  const f = new Fixture("1.10.3"); await f.start(join(directory, "session.json"));
  try {
    assert.equal((await browserLogin(f.config, "user-1", { headless: true })).id, "user-1");
    const previous = await readFile(f.config.sessionFile, "utf8");
    f.identity = "user-2"; f.renewal = true;
    await assert.rejects(browserLogin(f.config, "user-1", { headless: true }),
      { code: "identity-changed" });
    assert.equal(await readFile(f.config.sessionFile, "utf8"), previous);
  } finally { await f.close(); await rm(directory, { recursive: true, force: true }); }
});

test("browser-assisted discovery: forbidden HTTP 200 never provisions an anonymous cookie", {
  skip: process.env.HOGLET_BROWSER_TEST !== "1",
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-browser-"));
  const f = new Fixture("1.10.3"); await f.start(join(directory, "session.json"));
  f.identity = ""; f.renewal = true;
  const cancel = new AbortController();
  const timeout = setTimeout(() => cancel.abort(), 10000);
  try {
    const pending = browserLogin(f.config, undefined, { headless: true, signal: cancel.signal });
    const rejected = assert.rejects(pending);
    while (!f.meCalls && !cancel.signal.aborted) await new Promise(resolve => setTimeout(resolve, 20));
    assert(f.meCalls > 0);
    await assert.rejects(readFile(f.config.sessionFile), { code: "ENOENT" });
    cancel.abort(); await rejected;
    await assert.rejects(readFile(f.config.sessionFile), { code: "ENOENT" });
  } finally {
    clearTimeout(timeout); cancel.abort();
    await f.close(); await rm(directory, { recursive: true, force: true });
  }
});

test("browser-assisted discovery: storage failure ends provisioning promptly", {
  skip: process.env.HOGLET_BROWSER_TEST !== "1", timeout: 15000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-browser-"));
  const blocked = join(directory, "blocked");
  await writeFile(blocked, "not a directory", { mode: 0o600 });
  const f = new Fixture("1.10.3"); await f.start(join(blocked, "session.json"));
  try {
    await assert.rejects(browserLogin(f.config, undefined, { headless: true }));
    assert.equal(await readFile(blocked, "utf8"), "not a directory");
  } finally { await f.close(); await rm(directory, { recursive: true, force: true }); }
});
