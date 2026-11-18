import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, stat, chmod } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { configFromEnv, HogletError, safeError, type Config } from "../src/core.js";
import { MacKeychain, type Credentials } from "../src/keychain.js";
import { Session } from "../src/session.js";
import { Services } from "../src/services.js";
import { Fixture } from "./fixture.js";

class MemoryCredentials implements Credentials {
  values = new Map<string, string>();
  fail = false;
  mismatch = false;
  reads = 0;
  beforeRead?: () => Promise<void>;
  async get(account: string) {
    this.reads++;
    if (this.fail) throw new HogletError("keychain-unavailable", "Synthetic Keychain denial.");
    await this.beforeRead?.();
    return this.mismatch ? "mismatched readback" : this.values.get(account) ?? null;
  }
  async set(account: string, value: string) {
    if (this.fail) throw new HogletError("keychain-unavailable", "Synthetic Keychain denial.");
    this.values.set(account, value);
  }
  async delete(account: string) { this.values.delete(account); }
}

function config(directory: string, service = "first.example.test"): Config {
  return { ...configFromEnv({ XDG_DATA_HOME: directory, HOGLET_CREDENTIAL_STORE: "file" }, service),
    credentialStore: "keychain" };
}

test("Keychain storage: secret-free discovery, separate services, renewal and scoped logout", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-keychain-"));
  const store = new MemoryCredentials();
  const a = config(directory), b = config(directory, "second.example.test");
  const services = new Services({ XDG_DATA_HOME: directory, HOGLET_CREDENTIAL_STORE: "file" });
  try {
    for (const [cfg, secret, user] of [[a, "SYNTHETIC-KEYCHAIN-A", "user-a"], [b, "SYNTHETIC-KEYCHAIN-B", "user-b"]] as const) {
      const session = new Session(cfg, store);
      await session.provision("connect.sid=" + secret, user); await session.save();
      const text = await readFile(cfg.sessionFile, "utf8");
      assert(!text.includes(secret)); assert(!text.includes(Buffer.from(secret).toString("base64")));
      assert.equal(JSON.parse(text).schema, 2);
      assert.equal((await stat(cfg.sessionFile)).mode & 0o777, 0o600);
      assert.equal((await stat(dirname(cfg.sessionFile))).mode & 0o777, 0o700);
    }
    const reads = store.reads;
    assert.deepEqual(await services.list(), [
      { service: a.service.href, user_id: "user-a", release: "1.10.3" },
      { service: b.service.href, user_id: "user-b", release: "1.10.3" },
    ]);
    assert.equal(store.reads, reads, "Discovery must not read credentials");
    const live = new Session(a, store); await live.load();
    const generation = live.generation;
    const other = new Session(a, store); await other.load();
    const headers = new Headers({ "set-cookie": "connect.sid=SYNTHETIC-RENEWED; Path=/; HttpOnly" });
    await other.accept(headers, a.service);
    await live.checkStore();
    assert.equal(await live.cookie(a.service), "connect.sid=SYNTHETIC-RENEWED");
    assert(live.generation > generation);
    assert.equal(store.values.size, 2, "Superseded entries must be deleted");
    await other.logout();
    await assert.rejects(live.checkStore(), { code: "authentication-required" });
    assert.equal(store.values.size, 1);
    const remaining = new Session(b, store); await remaining.load();
    assert.equal(await remaining.cookie(b.service), "connect.sid=SYNTHETIC-KEYCHAIN-B");
    store.values.clear();
    await assert.rejects(remaining.checkStore(), { code: "authentication-required" });
    await assert.rejects(new Session(b, store).load(), { code: "authentication-required" });
  } finally { await services.close(); await rm(directory, { recursive: true, force: true }); }
});

test("Keychain storage: legacy migration verifies storage and preserves the original on failure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-keychain-"));
  const cfg = config(directory);
  const store = new MemoryCredentials();
  try {
    const legacy = new Session({ ...cfg, credentialStore: "file" });
    await legacy.provision("connect.sid=SYNTHETIC-LEGACY-COOKIE", "user-1"); await legacy.save();
    const original = await readFile(cfg.sessionFile, "utf8");
    store.fail = true;
    await assert.rejects(new Session(cfg, store).load(), { code: "keychain-unavailable" });
    assert.equal(await readFile(cfg.sessionFile, "utf8"), original);
    store.fail = false; store.mismatch = true;
    await assert.rejects(new Session(cfg, store).load(), { code: "keychain-unavailable" });
    assert.equal(await readFile(cfg.sessionFile, "utf8"), original);
    assert.equal(store.values.size, 0);
    store.mismatch = false;
    // A verified secret must also be cleaned up if metadata publication fails.
    store.beforeRead = () => chmod(dirname(cfg.sessionFile), 0o500);
    await assert.rejects(new Session(cfg, store).load());
    await chmod(dirname(cfg.sessionFile), 0o700);
    assert.equal(await readFile(cfg.sessionFile, "utf8"), original);
    assert.equal(store.values.size, 0);
    store.beforeRead = undefined;
    const migrated = new Session(cfg, store); await migrated.load();
    assert.equal(await migrated.cookie(cfg.service), "connect.sid=SYNTHETIC-LEGACY-COOKIE");
    assert(!((await readFile(cfg.sessionFile, "utf8")).includes("SYNTHETIC-LEGACY-COOKIE")));
    // Selecting files for new sessions must not export an existing Keychain record.
    const reopened = new Session({ ...cfg, credentialStore: "file" }, store); await reopened.load();
    await reopened.save();
    assert.equal(JSON.parse(await readFile(cfg.sessionFile, "utf8")).schema, 2);
    assert.equal(store.values.size, 1);
  } finally { await chmod(dirname(cfg.sessionFile), 0o700).catch(() => {}); await rm(directory, { recursive: true, force: true }); }
});

test("Keychain storage: denied access never creates a plaintext session and mismatched scope is rejected", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-keychain-"));
  const cfg = config(directory), store = new MemoryCredentials();
  try {
    const session = new Session(cfg, store);
    await session.provision("connect.sid=SYNTHETIC-PRIVATE-COOKIE", "user-1");
    store.fail = true;
    await assert.rejects(session.save(), { code: "keychain-unavailable" });
    await assert.rejects(readFile(cfg.sessionFile), { code: "ENOENT" });
    store.fail = false; await session.save();
    const text = await readFile(cfg.sessionFile, "utf8");
    const metadata = JSON.parse(text);
    const account = cfg.service.href + " " + metadata.credential_ref;
    const wrong = JSON.parse(store.values.get(account)!);
    wrong.service = "https://another.example.test/";
    store.values.set(account, JSON.stringify(wrong));
    await assert.rejects(new Session(cfg, store).load(), { code: "session-storage" });
    metadata.service = "https://another.example.test/";
    await writeFile(cfg.sessionFile, JSON.stringify(metadata));
    const reads = store.reads;
    await assert.rejects(new Session(cfg, store).load(), { code: "session-storage" });
    assert.equal(store.reads, reads);
    assert(!JSON.stringify(safeError(new Error("SYNTHETIC-PRIVATE-COOKIE"))).includes("SYNTHETIC-PRIVATE-COOKIE"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Keychain storage: actual macOS CLI provisioning and MCP reuse", {
  skip: process.platform !== "darwin" || process.env.HOGLET_KEYCHAIN_TEST !== "1",
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-native-keychain-"));
  const a = new Fixture("1.10.3"), b = new Fixture("1.12.0", "/other/");
  await a.start(join(directory, "unused-a")); await b.start(join(directory, "unused-b"));
  b.nextCookie = "SYNTHETIC-NATIVE-KEYCHAIN-B"; b.identity = b.owner = "user-2";
  const env = { ...process.env, XDG_DATA_HOME: directory, HOGLET_CREDENTIAL_STORE: "keychain",
    HOGLET_SERVICE: undefined, HOGLET_SESSION_FILE: undefined };
  const configs = [a, b].map(f => configFromEnv({ ...env, HOGLET_RELEASE: f.release }, f.config.service.href));
  const client = new Client({ name: "hoglet-keychain-test", version: "1" });
  const keychain = new MacKeychain();
  try {
    for (const [i, f] of [a, b].entries()) {
      const input = join(directory, "import-" + i);
      await writeFile(input, "connect.sid=" + f.nextCookie, { mode: 0o600 });
      const args = ["dist/src/cli.js", "import-session", f.config.service.href, "--user-id", f.identity, "--file", input];
      const child = spawn(process.execPath, args, { env: { ...env, HOGLET_RELEASE: f.release }, timeout: 20000 });
      let output = "";
      child.stdout.on("data", x => { output += x; }); child.stderr.on("data", x => { output += x; });
      const [code] = await once(child, "close"); assert.equal(code, 0, output);
      assert(!output.includes(f.nextCookie)); assert(!args.join(" ").includes(f.nextCookie));
      await rm(input);
      const text = await readFile(configs[i].sessionFile, "utf8");
      assert(!text.includes(f.nextCookie)); assert.equal(JSON.parse(text).schema, 2);
    }
    const transport = new StdioClientTransport({
      command: process.execPath, args: ["dist/src/cli.js", "serve"],
      env: Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)),
      stderr: "pipe",
    });
    let diagnostics = ""; transport.stderr?.on("data", x => { diagnostics += x; });
    await client.connect(transport);
    const list = await client.callTool({ name: "list_services", arguments: {} });
    assert.equal((list.structuredContent as any).services.length, 2);
    for (const f of [a, b]) {
      const read = await client.callTool({ name: "read_note", arguments: { service: f.config.service.href, note: "note" } });
      assert.equal(read.isError, false);
      assert.equal((read.structuredContent as any).markdown, f.stored);
      assert(f.requests.some(r => r.cookie.includes(f.nextCookie)));
    }
    const cfg = configs[0];
    const session = new Session(cfg); await session.load();
    const previous = JSON.parse(await readFile(cfg.sessionFile, "utf8"));
    await session.accept(new Headers({ "set-cookie": "connect.sid=SYNTHETIC-NATIVE-RENEWED; Path=/; HttpOnly" }), cfg.service);
    assert.equal(await keychain.get(cfg.service.href + " " + previous.credential_ref), null);
    const reopened = new Session(cfg); await reopened.load();
    assert.equal(await reopened.cookie(cfg.service), "connect.sid=SYNTHETIC-NATIVE-RENEWED");
    await session.logout();
    const loggedOut = await client.callTool({ name: "read_note", arguments: { service: cfg.service.href, note: "note" } });
    assert.equal(loggedOut.isError, true);
    assert.equal((loggedOut.structuredContent as any).error.code, "authentication-required");
    const remaining = new Session(configs[1]); await remaining.load();
    assert.equal(await remaining.cookie(configs[1].service), "connect.sid=" + b.nextCookie);
    assert.equal((await client.callTool({ name: "read_note",
      arguments: { service: configs[1].service.href, note: "note" } })).isError, false);
    const record = JSON.parse(await readFile(configs[1].sessionFile, "utf8"));
    await keychain.delete(configs[1].service.href + " " + record.credential_ref);
    await assert.rejects(remaining.checkStore(), { code: "authentication-required" });
    const requests = b.requests.length;
    const missing = await client.callTool({ name: "read_note", arguments: { service: configs[1].service.href, note: "note" } });
    assert.equal(missing.isError, true);
    assert.equal((missing.structuredContent as any).error.code, "authentication-required");
    assert.equal(b.requests.length, requests, "Missing Keychain credentials must prevent network access");
    assert(!diagnostics.includes(a.nextCookie)); assert(!diagnostics.includes(b.nextCookie));
    // Exercise verified migration using the actual native store too.
    const legacy = new Session({ ...cfg, credentialStore: "file" });
    await legacy.provision("connect.sid=SYNTHETIC-NATIVE-MIGRATION", "user-1"); await legacy.save();
    await new Session(cfg).load();
    assert(!((await readFile(cfg.sessionFile, "utf8")).includes("SYNTHETIC-NATIVE-MIGRATION")));
  } finally {
    await client.close();
    for (const cfg of configs) await new Session(cfg).logout();
    await a.close(); await b.close(); await rm(directory, { recursive: true, force: true });
  }
});
