import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, chmod, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { configFromEnv } from "../src/core.js";
import { Session } from "../src/session.js";
import { Services } from "../src/services.js";

test("saved services: legacy record compatibility and scoped credential rejection", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-store-"));
  const env = { XDG_DATA_HOME: directory, HOGLET_CREDENTIAL_STORE: "file" };
  const a = configFromEnv(env, "first.example.test");
  const b = configFromEnv(env, "second.example.test");
  const services = new Services(env);
  try {
    const session = new Session(a);
    await session.provision("connect.sid=SYNTHETIC-LEGACY", "legacy-user"); await session.save();
    const record = JSON.parse(await readFile(a.sessionFile, "utf8"));
    delete record.release; delete record.cookie_name;
    await writeFile(a.sessionFile, JSON.stringify(record));
    assert.deepEqual(await services.list(), [{ service: a.service.href, user_id: "legacy-user", release: "1.10.3" }]);
    assert.equal((await services.bridge()).session.userId, "legacy-user");
    const other = new Session(b);
    await other.provision("connect.sid=SYNTHETIC-OTHER", "other-user"); await other.save();
    await copyFile(b.sessionFile, a.sessionFile);
    const fresh = new Services(env);
    try {
      await assert.rejects(fresh.bridge(a.service.href), { code: "session-storage" });
      await assert.rejects(fresh.list(), { code: "session-storage" });
    } finally { await fresh.close(); }
  } finally { await services.close(); await rm(directory, { recursive: true, force: true }); }
});

test("saved services: private storage and custom file need an explicit default", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-store-"));
  const env = { XDG_DATA_HOME: directory, HOGLET_CREDENTIAL_STORE: "file" };
  const config = configFromEnv(env, "private.example.test");
  const services = new Services(env);
  try {
    const session = new Session(config);
    await session.provision("connect.sid=SYNTHETIC-PRIVATE", "private-user"); await session.save();
    await chmod(config.sessionFile, 0o644);
    await assert.rejects(services.bridge(config.service.href), { code: "session-storage" });
    await assert.rejects(services.list(), { code: "session-storage" });
    assert.throws(() => new Services({ ...env, HOGLET_SESSION_FILE: join(directory, "custom.json") }),
      { code: "configuration" });
  } finally { await services.close(); await rm(directory, { recursive: true, force: true }); }
});
