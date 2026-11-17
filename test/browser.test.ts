import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
    const me = await browserLogin(f.config, "user-1", { headless: true });
    assert.equal(me.id, "user-1");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    try {
      await context.addCookies([
        { name: "connect.sid", value: "SYNTHETIC-HD", url: f.config.service.href },
        { name: "github-token", value: "SYNTHETIC-GH-DO-NOT-EXPORT", url: f.config.service.href },
        { name: "unrelated", value: "SYNTHETIC-OTHER", url: "http://example.test" },
      ]);
      const session = new Session(f.config);
      assert.equal(await importBrowserCredential(context, session, "user-1"), true);
      await session.save();
      const text = await readFile(f.config.sessionFile, "utf8");
      assert(!text.includes("SYNTHETIC-GH")); assert(!text.includes("SYNTHETIC-OTHER"));
      assert.equal(JSON.parse(text).cookies.length, 1);
    } finally { await context.close(); await browser.close(); }
  } finally { await f.close(); await rm(directory, { recursive: true, force: true }); }
});
