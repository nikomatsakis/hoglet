import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configFromEnv } from "../src/core.js";
import { Session } from "../src/session.js";
import { Fixture, SECRET } from "./fixture.js";

// A-cli-note-operations:command-contracts,command-cancellation
function start(args: string[], env: NodeJS.ProcessEnv, input?: string, keepOpen = false) {
  const child = spawn(process.execPath, ["dist/src/cli.js", ...args], { env, timeout: 5000 });
  let out = "", err = "";
  child.stdout.on("data", chunk => { out += chunk; });
  child.stderr.on("data", chunk => { err += chunk; });
  const done = once(child, "close").then(([code, signal]) => ({ code, signal, out, err }));
  if (input !== undefined) child.stdin.write(input);
  if (!keepOpen) child.stdin.end();
  return { child, done };
}
async function cli(args: string[], env: NodeJS.ProcessEnv, input?: string) {
  return start(args, env, input).done;
}
async function until(check: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!check()) {
    assert(Date.now() < deadline, "Fixture observation did not occur.");
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
async function setup(release: "1.10.3" | "1.12.0", work: (f: Fixture, env: NodeJS.ProcessEnv, directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-note-cli-"));
  const f = new Fixture(release);
  await f.start(join(directory, "unused"));
  const env: NodeJS.ProcessEnv = { ...process.env, XDG_DATA_HOME: directory,
    HOGLET_CREDENTIAL_STORE: "file", HOGLET_SERVICE: undefined, HOGLET_SESSION_FILE: undefined,
    HOGLET_ANONYMOUS: undefined, HOGLET_RELEASE: release, HOGLET_COOKIE_NAME: "connect.sid",
    HOGLET_CALL_MS: "1500", HOGLET_CONNECT_MS: "500", HOGLET_ACK_MS: "200", HOGLET_PERSIST_MS: "200",
  };
  const config = configFromEnv(env, f.config.service.href);
  const session = new Session(config);
  await session.provision("connect.sid=" + SECRET, "user-1"); await session.save();
  try { await work(f, env, directory); }
  finally { await f.close(); await rm(directory, { recursive: true, force: true }); }
}

for (const release of ["1.10.3", "1.12.0"] as const) {
  test(`CLI ${release}: services, exact raw/JSON reads, info, file/stdin edits and stale rejection`, () => setup(release, async (f, env, directory) => {
    const list = await cli(["services"], env);
    assert.equal(list.code, 0, list.err);
    assert.deepEqual(JSON.parse(list.out), { services: [{ service: f.config.service.href, user_id: "user-1", release }] });
    const raw = await cli(["read", "note"], env);
    assert.equal(raw.code, 0, raw.err); assert.equal(raw.out, "Hello 😀 world\r\n"); assert.equal(raw.err, "");
    const read = await cli(["read", "note", "--json", "--service", f.config.service.href], env);
    const base = JSON.parse(read.out);
    assert.equal(base.markdown, raw.out); assert.equal(base.service, f.config.service.href); assert.equal(base.source, "persisted");
    const info = await cli(["info", "note"], env);
    assert.equal(info.code, 0, info.err);
    assert.equal(JSON.parse(info.out).title, "Test"); assert.equal(JSON.parse(info.out).service, f.config.service.href);
    const edits = join(directory, "edits with spaces.json");
    await writeFile(edits, JSON.stringify([{ old_text: "world", new_text: "CLI" }, { old_text: "Hello", new_text: "Hi" }]));
    const edit = await cli(["edit", "note", "--snapshot", base.snapshot, "--edits", edits], env);
    assert.equal(edit.code, 0, edit.err); assert.equal(JSON.parse(edit.out).outcome, "persisted-observed");
    assert.equal(f.stored, "Hi 😀 CLI\r\n"); assert.equal(f.operations, 1);
    const stale = await cli(["edit", "note", "--snapshot", base.snapshot, "--edits", "-"], env,
      JSON.stringify([{ old_text: "CLI", new_text: "again" }]));
    assert.equal(stale.code, 1); assert.equal(JSON.parse(stale.out).outcome, "stale-snapshot"); assert.equal(f.operations, 1);
    const fresh = JSON.parse((await cli(["read", "note", "--json"], env)).out);
    const noop = await cli(["edit", "note", "--snapshot", fresh.snapshot, "--edits", "-"], env,
      JSON.stringify([{ old_text: "CLI", new_text: "CLI" }]));
    assert.equal(noop.code, 0); assert.equal(JSON.parse(noop.out).outcome, "unchanged"); assert.equal(f.operations, 1);
    const invalid = await cli(["edit", "note", "--snapshot", fresh.snapshot, "--edits", "-"], env,
      JSON.stringify([{ old_text: "absent", new_text: "anything" }]));
    assert.equal(invalid.code, 1); assert.equal(JSON.parse(invalid.out).outcome, "rejected"); assert.equal(f.operations, 1);
    const hyphen = await cli(["read", "--", "--note"], env);
    assert.equal(hyphen.code, 0, hyphen.err); assert.equal(hyphen.out, "Hi 😀 CLI\r\n");
    f.stored = "";
    assert.equal((await cli(["read", "note"], env)).out, "", "An empty raw note must stay empty.");
    for (const result of [list, raw, read, info, edit, stale, invalid])
      for (const encoded of [SECRET, encodeURIComponent(SECRET), Buffer.from(SECRET).toString("base64")])
        assert(!(result.out + result.err).includes(encoded));
    await until(() => f.sockets.size === 0);
  }));

  for (const mode of ["silent", "no-save", "drop"] as const) {
    test(`CLI ${release}: ${mode} preserves classified write outcomes and exits without replay`, () => setup(release, async (f, env) => {
      const base = JSON.parse((await cli(["read", "note", "--json"], env)).out);
      f.mode = mode;
      const edit = await cli(["edit", "note", "--snapshot", base.snapshot, "--edits", "-"], env,
        JSON.stringify([{ old_text: "world", new_text: "fault" }]));
      assert.equal(edit.code, 2, edit.err);
      const result = JSON.parse(edit.out);
      assert.equal(result.outcome, mode === "no-save" ? "accepted" : "uncertain");
      assert.equal(result.submitted, true); assert.equal(result.persistence, "not-observed");
      assert.equal(result.acceptance, mode === "no-save" ? "acknowledged" : "unknown");
      assert.equal(f.operations, 1);
      await until(() => f.sockets.size === 0);
    }));
  }
}

test("CLI selection: explicit/default/ambiguous/unsaved services retain scoped snapshots", () => setup("1.10.3", async (a, env, directory) => {
  const b = new Fixture("1.12.0", "/second/");
  const unsaved = new Fixture("1.10.3", "/unsaved/");
  await b.start(join(directory, "unused-b")); await unsaved.start(join(directory, "unused-c"));
  try {
    b.stored = b.base = "Second service";
    const session = new Session(configFromEnv({ ...env, HOGLET_RELEASE: b.release }, b.config.service.href));
    await session.provision("connect.sid=" + SECRET, "user-1"); await session.save();
    assert.equal(JSON.parse((await cli(["services"], env)).out).services.length, 2);
    const ambiguous = await cli(["read", "note"], env);
    assert.equal(ambiguous.code, 1); assert.equal(JSON.parse(ambiguous.err).error.code, "service-required");
    const implicit = await cli(["read", "note"], { ...env, HOGLET_SERVICE: a.config.service.href });
    assert.equal(implicit.out, a.stored);
    const explicit = await cli(["read", "note", "--service", b.config.service.href], { ...env, HOGLET_SERVICE: "invalid://env" });
    assert.equal(explicit.code, 0, explicit.err); assert.equal(explicit.out, "Second service");
    const missing = await cli(["read", "note", "--service", unsaved.config.service.href], env);
    assert.equal(missing.code, 1); assert.equal(JSON.parse(missing.err).error.code, "authentication-required");
    assert.equal(unsaved.requests.length, 0);
    const fromA = JSON.parse((await cli(["read", "note", "--json", "--service", a.config.service.href], env)).out);
    const wrongScope = await cli(["edit", "note", "--service", b.config.service.href, "--snapshot", fromA.snapshot, "--edits", "-"],
      env, JSON.stringify([{ old_text: "Second", new_text: "wrong" }]));
    assert.equal(wrongScope.code, 1); assert.equal(JSON.parse(wrongScope.out).outcome, "stale-snapshot"); assert.equal(b.operations, 0);
    a.identity = "";
    const expired = await cli(["read", "note", "--service", a.config.service.href], env);
    assert.equal(expired.code, 1); assert.equal(expired.out, ""); assert.equal(JSON.parse(expired.err).error.code, "authentication-required");
  } finally { await b.close(); await unsaved.close(); }
}));

test("CLI validation: invalid arguments, JSON, UTF-8 and bounded input submit nothing and do not echo input", () => setup("1.10.3", async (f, env, directory) => {
  const token = "sha256:" + "0".repeat(64);
  for (const args of [
    ["read"], ["read", "note", "extra"], ["services", "note"], ["read", "note", "--json", "--json"],
    ["edit", "note"], ["edit", "note", "--snapshot", "invalid", "--edits", "-"],
    ["edit", "note", "--snapshot", token, "--edits", "-"], ["read", "note", "--cookie", SECRET],
  ]) {
    const result = await cli(args, env, "SYNTHETIC-PRIVATE-EDIT");
    assert.equal(result.code, 1); assert.equal(result.out, "");
    assert(!(result.err.includes(SECRET) || result.err.includes("SYNTHETIC-PRIVATE-EDIT")));
  }
  for (const input of ["[]", "[{}]", '[{"old_text":"a","new_text":"b","extra":"secret"}]']) {
    const result = await cli(["edit", "note", "--snapshot", token, "--edits", "-"], env, input);
    assert.equal(result.code, 1); assert.equal(JSON.parse(result.err).error.code, "invalid-arguments");
  }
  const brokenUtf8 = join(directory, "bad-utf8.json"); await writeFile(brokenUtf8, Buffer.from([0xff]));
  const invalidUtf8 = await cli(["edit", "note", "--snapshot", token, "--edits", brokenUtf8], env);
  assert.equal(invalidUtf8.code, 1); assert.equal(JSON.parse(invalidUtf8.err).error.code, "invalid-edit");
  const large = await cli(["edit", "note", "--snapshot", token, "--edits", "-"], { ...env, HOGLET_MAX_BYTES: "1" }, " ".repeat(40000));
  assert.equal(large.code, 1); assert.equal(JSON.parse(large.err).error.code, "content-limit");
  assert.equal(f.requests.length, 0); assert.equal(f.operations, 0);
}));

test("CLI cancellation: stalled stdin is bounded and interruptible before network access", () => setup("1.10.3", async (f, env) => {
  const args = ["edit", "note", "--snapshot", "sha256:" + "0".repeat(64), "--edits", "-"];
  const timed = start(args, { ...env, HOGLET_CALL_MS: "100" }, "[", true);
  const timeout = await timed.done;
  assert.equal(timeout.code, 1, timeout.err); assert.equal(JSON.parse(timeout.err).error.code, "observation-ended");
  const canceled = start(args, env, "[", true);
  // Wait until the process has loaded its CLI and established signal handlers.
  await new Promise(resolve => setTimeout(resolve, 350));
  canceled.child.kill("SIGINT");
  const stopped = await canceled.done;
  assert.equal(stopped.code, 130, stopped.err); assert.equal(stopped.signal, null);
  assert.equal(f.requests.length, 0); assert.equal(f.operations, 0);
}));

test("CLI cancellation: stalled HTTP exits before submission", () => setup("1.10.3", async (f, env) => {
  f.httpMode = "stall";
  const pending = start(["read", "note"], env);
  await until(() => f.requests.some(r => r.path.endsWith("/me")));
  pending.child.kill("SIGINT");
  const result = await pending.done;
  assert.equal(result.code, 130, result.err); assert.equal(result.out, ""); assert.equal(f.operations, 0);
}));

for (const acknowledged of [false, true]) {
  test(`CLI cancellation: post-submission ${acknowledged ? "acknowledgement" : "uncertainty"} is retained`, () => setup("1.10.3", async (f, env) => {
    const base = JSON.parse((await cli(["read", "note", "--json"], env)).out);
    f.mode = acknowledged ? "no-save" : "silent";
    if (acknowledged) f.httpMode = "stall-persistence";
    const pending = start(["edit", "note", "--snapshot", base.snapshot, "--edits", "-"], env,
      JSON.stringify([{ old_text: "world", new_text: "cancel" }]));
    await until(() => f.operations === 1 && (!acknowledged || f.requests.filter(r => r.path.endsWith("/download")).length > 1));
    pending.child.kill("SIGTERM");
    const result = await pending.done;
    assert.equal(result.code, 143, result.err); assert.equal(result.signal, null);
    assert.equal(JSON.parse(result.out).outcome, acknowledged ? "accepted" : "uncertain");
    assert.equal(JSON.parse(result.out).acceptance, acknowledged ? "acknowledged" : "unknown");
    assert.equal(f.operations, 1);
    await until(() => f.sockets.size === 0);
  }));
}
