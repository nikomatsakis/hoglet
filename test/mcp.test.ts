import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm, writeFile, stat, readFile } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { configFromEnv } from "../src/core.js";
import { Session } from "../src/session.js";
import { Fixture, SECRET } from "./fixture.js";

class McpProcess {
  child: ChildProcessWithoutNullStreams;
  stdout = "";
  stderr = "";
  messages: any[] = [];
  private buffer = "";
  private nextId = 1;
  private pending = new Map<number, { resolve: (x: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  constructor(f: Fixture, overrides: NodeJS.ProcessEnv = {}, args = ["mcp"]) {
    this.child = spawn(process.execPath, ["dist/src/cli.js", ...args], {
      cwd: resolve("."), env: {
        ...process.env, HOGLET_CREDENTIAL_STORE: "file", HOGLET_SERVICE: f.config.service.href, HOGLET_RELEASE: f.release,
        HOGLET_SESSION_FILE: f.config.sessionFile, HOGLET_CALL_MS: "700",
        XDG_DATA_HOME: dirname(f.config.sessionFile),
        HOGLET_CONNECT_MS: "250", HOGLET_ACK_MS: "250", HOGLET_PERSIST_MS: "250",
        ...overrides,
      },
    });
    this.child.stdout.on("data", chunk => {
      this.stdout += chunk; this.buffer += chunk;
      for (;;) {
        const end = this.buffer.indexOf("\n"); if (end < 0) break;
        const line = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 1);
        try {
          const message = JSON.parse(line); this.messages.push(message);
          const p = this.pending.get(message.id);
          if (p) { clearTimeout(p.timer); this.pending.delete(message.id); p.resolve(message); }
        } catch {
          for (const p of this.pending.values()) p.reject(new Error("Non-JSON stdout corrupted MCP."));
        }
      }
    });
    this.child.stderr.on("data", chunk => { this.stderr += chunk; });
  }
  send(method: string, params: Record<string, unknown>) {
    const id = this.nextId++;
    const promise = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error("MCP test response deadline.")); }, 5000);
      this.pending.set(id, { resolve, reject, timer });
    });
    this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    return { id, promise };
  }
  call(method: string, params: Record<string, unknown>) { return this.send(method, params).promise; }
  notify(method: string, params?: Record<string, unknown>) {
    this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, ...(params ? { params } : {}) }) + "\n");
  }
  forget(id: number) {
    const p = this.pending.get(id);
    if (p) { clearTimeout(p.timer); this.pending.delete(id); p.resolve({ cancelled: true }); }
  }
  tool(name: string, args: Record<string, unknown>) { return this.call("tools/call", { name, arguments: args }); }
  async initialize() {
    const response = await this.call("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "independent-acceptance", version: "1" } });
    assert.equal(response.result.protocolVersion, "2025-11-25");
    this.notify("notifications/initialized");
  }
  async stop() {
    if (this.child.exitCode === null && this.child.signalCode === null) {
      const ended = once(this.child, "exit");
      this.child.kill("SIGTERM");
      await Promise.race([ended, new Promise<never>((_, reject) => {
        const timer = setTimeout(() => { this.child.kill("SIGKILL"); reject(new Error("Server did not stop in its grace period.")); }, 2000);
        timer.unref();
      })]);
    }
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error("Stopped MCP process.")); }
    this.pending.clear();
  }
}

async function fixtureProcess(release: "1.10.3" | "1.12.0", run: (f: Fixture, client: McpProcess) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-mcp-"));
  const f = new Fixture(release); await f.start(join(directory, "session.json"));
  const session = new Session(f.config); await session.provision("connect.sid=" + SECRET, "user-1"); await session.save();
  const client = new McpProcess(f);
  try { await client.initialize(); await run(f, client); }
  finally { await client.stop(); await f.close(); await rm(directory, { recursive: true, force: true }); }
}

test("MCP command aliases: mcp and serve accept a positional default service and emit only protocol", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-mcp-command-"));
  const f = new Fixture("1.10.3");
  await f.start(join(directory, "session.json"));
  const session = new Session(f.config);
  await session.provision("connect.sid=" + SECRET, "user-1"); await session.save();
  try {
    for (const command of ["mcp", "serve"]) {
      const client = new McpProcess(f, { HOGLET_SERVICE: "invalid://environment" }, [command, f.config.service.href]);
      try {
        await client.initialize();
        assert.equal((await client.call("tools/list", {})).result.tools.length, 4);
        const read = (await client.tool("read_note", { note: "note" })).result.structuredContent;
        assert.equal(read.markdown, "Hello 😀 world\r\n");
        assert.equal(read.service, f.config.service.href);
        assert(client.stdout.trim().split("\n").every(line => JSON.parse(line).jsonrpc === "2.0"));
        assert(!(client.stdout + client.stderr).includes(SECRET));
      } finally { await client.stop(); }
    }
  } finally { await f.close(); await rm(directory, { recursive: true, force: true }); }
});

for (const release of ["1.10.3", "1.12.0"] as const) {
  test(`MCP ${release}: initialize/discover/all tools/errors, pure protocol stdout`, () => fixtureProcess(release, async (f, c) => {
    const list = await c.call("tools/list", {});
    assert.deepEqual(list.result.tools.map((t: any) => t.name), ["list_services", "read_note", "get_note_info", "edit_note"]);
    assert(!JSON.stringify(list).includes("cookie"));
    const read = (await c.tool("read_note", { note: "note" })).result.structuredContent;
    assert.equal(read.markdown, "Hello 😀 world\r\n");
    assert.equal((await c.tool("get_note_info", { note: "note" })).result.structuredContent.title, "Test");
    const edited = (await c.tool("edit_note", { note: "note", expected_snapshot: read.snapshot, edits: [{ old_text: "world", new_text: "MCP" }] })).result;
    assert.equal(edited.isError, false); assert.equal(edited.structuredContent.markdown, "Hello 😀 MCP\r\n");
    const invalid = await c.tool("read_note", { note: 12 });
    assert(invalid.error || invalid.result?.isError);
    const unknown = await c.tool("invented_tool", {});
    assert(unknown.error || unknown.result?.isError);
    assert.equal((await c.tool("read_note", { note: "missing" })).result.isError, true);
    assert.equal((await c.tool("get_note_info", { note: "../escape" })).result.isError, true);
    assert.equal((await c.tool("edit_note", { note: "note", expected_snapshot: read.snapshot, edits: [{ old_text: "world", new_text: "again" }] })).result.structuredContent.outcome, "stale-snapshot");
    assert.equal(f.operations, 1);
    assert(c.stdout.trim().split("\n").every(line => JSON.parse(line).jsonrpc === "2.0"));
    for (const encoded of [SECRET, encodeURIComponent(SECRET), Buffer.from(SECRET).toString("base64")])
      assert(!(c.stdout + c.stderr).includes(encoded));
  }));
}

for (const fault of ["HTTP stall", "socket stall", "ack stall", "save stall", "large response"] as const) {
  test(`MCP bounded calls: ${fault}`, () => fixtureProcess("1.10.3", async (f, c) => {
    const read = (await c.tool("read_note", { note: "note" })).result.structuredContent;
    if (fault === "HTTP stall") f.httpMode = "stall";
    if (fault === "large response") f.httpMode = "large";
    if (fault === "socket stall") f.stallConnect = true;
    if (fault === "ack stall") f.mode = "silent";
    if (fault === "save stall") f.httpMode = "stall-persistence";
    const start = performance.now();
    const response = fault === "HTTP stall" || fault === "large response"
      ? await c.tool("read_note", { note: "note" })
      : await c.tool("edit_note", { note: "note", expected_snapshot: read.snapshot, edits: [{ old_text: "world", new_text: "X" }] });
    assert(performance.now() - start < 1400);
    if (fault === "ack stall") assert.equal(response.result.structuredContent.outcome, "uncertain");
    else if (fault === "save stall") assert.equal(response.result.structuredContent.outcome, "accepted");
    else assert.equal(response.result.isError, true);
    assert.equal(f.operations, ["ack stall", "save stall"].includes(fault) ? 1 : 0);
  }));
}

test("MCP cancellation after submission reports uncertain, no replay", () => fixtureProcess("1.10.3", async (f, c) => {
  const read = (await c.tool("read_note", { note: "note" })).result.structuredContent;
  f.mode = "silent";
  const { id, promise } = c.send("tools/call", { name: "edit_note", arguments: { note: "note", expected_snapshot: read.snapshot, edits: [{ old_text: "world", new_text: "X" }] } });
  while (!f.operations) await new Promise(resolve => setTimeout(resolve, 5));
  c.notify("notifications/cancelled", { requestId: id, reason: "Synthetic cancellation" });
  c.forget(id); assert.equal((await promise).cancelled, true);
  for (let i = 0; !c.stderr.includes("cancelled-edit") && i < 40; i++) await new Promise(resolve => setTimeout(resolve, 5));
  const log = c.stderr.trim().split("\n").map(line => JSON.parse(line)).find(m => m.event === "cancelled-edit");
  assert.equal(log.outcome, "uncertain"); assert.equal(log.acceptance, "unknown");
  assert(!c.messages.some(m => m.id === id));
  assert.equal((await c.tool("read_note", { note: "note" })).result.isError, false);
  assert.equal(f.operations, 1);
}));

test("MCP graceful shutdown preserves pending uncertainty and exits", () => fixtureProcess("1.10.3", async (f, c) => {
  const read = (await c.tool("read_note", { note: "note" })).result.structuredContent;
  f.mode = "silent";
  const pending = c.tool("edit_note", { note: "note", expected_snapshot: read.snapshot, edits: [{ old_text: "world", new_text: "X" }] });
  while (!f.operations) await new Promise(resolve => setTimeout(resolve, 5));
  c.child.kill("SIGTERM");
  assert.equal((await pending).result.structuredContent.outcome, "uncertain");
  await c.stop(); assert.equal(f.operations, 1);
}));

test("local session import CLI uses protected file and prints only identity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-import-"));
  const f = new Fixture("1.10.3"); await f.start(join(directory, "session.json"));
  const cookieFile = join(directory, "input"); await writeFile(cookieFile, "connect.sid=" + SECRET, { mode: 0o600 });
  try {
    const child = spawn(process.execPath, ["dist/src/cli.js", "import-session", "--user-id", "user-1", "--file", cookieFile], {
      env: { ...process.env, HOGLET_CREDENTIAL_STORE: "file", HOGLET_SERVICE: f.config.service.href, HOGLET_SESSION_FILE: f.config.sessionFile },
    });
    let out = "", err = ""; child.stdout.on("data", c => { out += c; }); child.stderr.on("data", c => { err += c; });
    const [code] = await once(child, "exit"); assert.equal(code, 0, err);
    assert.deepEqual(JSON.parse(out), { id: "user-1", name: "Synthetic user" }); assert(!out.includes(SECRET)); assert(!err.includes(SECRET));
    assert.equal((await stat(f.config.sessionFile)).mode & 0o777, 0o600);
    const record = JSON.parse(await readFile(f.config.sessionFile, "utf8"));
    assert.equal(record.cookies.length, 1); assert.equal(record.cookies[0].key, "connect.sid");
  } finally { await f.close(); await rm(directory, { recursive: true, force: true }); }
});

test("MCP multiple services: console import, XDG discovery, routing and scoped logout", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-services-"));
  const fixtures = [new Fixture("1.10.3"), new Fixture("1.12.0", "/second/"), new Fixture("1.10.3", "/unsaved/")];
  for (let i = 0; i < fixtures.length; i++) await fixtures[i].start(join(directory, `placeholder-${i}.json`));
  const [a, b, unsaved] = fixtures;
  a.nextCookie = "SYNTHETIC-SERVICE-A-CREDENTIAL";
  b.nextCookie = "SYNTHETIC-SERVICE-B-CREDENTIAL"; b.identity = b.owner = "user-2";
  b.config.cookieName = "custom.sid";
  const env = { ...process.env, XDG_DATA_HOME: directory, HOGLET_CREDENTIAL_STORE: "file",
    HOGLET_SERVICE: undefined, HOGLET_SESSION_FILE: undefined, HOGLET_RELEASE: "1.10.3",
    HOGLET_CALL_MS: "4000", HOGLET_ACK_MS: "2000" };
  async function local(args: string[], release = "1.10.3", cookieName = "connect.sid") {
    const child = spawn(process.execPath, ["dist/src/cli.js", ...args], {
      env: { ...env, HOGLET_RELEASE: release, HOGLET_COOKIE_NAME: cookieName }, timeout: 5000,
    });
    let out = "", err = "";
    child.stdout.on("data", c => { out += c; }); child.stderr.on("data", c => { err += c; });
    const [code] = await once(child, "close"); assert.equal(code, 0, err);
    assert(!(out + err).includes(a.nextCookie)); assert(!(out + err).includes(b.nextCookie));
    return out;
  }
  async function provision(f: Fixture, name: string) {
    const input = join(directory, name);
    await writeFile(input, f.config.cookieName + "=" + f.nextCookie, { mode: 0o600 });
    const out = await local(["import-session", f.config.service.href,
      "--user-id", f.identity, "--file", input], f.release, f.config.cookieName);
    assert.equal(JSON.parse(out).id, f.identity);
    f.config.sessionFile = configFromEnv(env, f.config.service.href).sessionFile;
    const record = JSON.parse(await readFile(f.config.sessionFile, "utf8"));
    assert.equal(record.release, f.release);
    assert.equal(record.cookie_name, f.config.cookieName);
    assert.equal((await stat(f.config.sessionFile)).mode & 0o777, 0o600);
  }
  let client: McpProcess | undefined;
  try {
    await provision(a, "input-a");
    client = new McpProcess(a, env); await client.initialize();
    const first = (await client.tool("read_note", { note: "note" })).result.structuredContent;
    assert.equal(first.service, a.config.service.href);
    await provision(b, "input-b"); // The MCP process is already running.
    assert.notEqual(a.config.sessionFile, b.config.sessionFile);
    const listed = (await client.tool("list_services", {})).result.structuredContent;
    assert.deepEqual(new Set(listed.services.map((s: any) => `${s.service}|${s.user_id}|${s.release}`)),
      new Set([`${a.config.service.href}|user-1|1.10.3`, `${b.config.service.href}|user-2|1.12.0`]));
    assert.equal((await client.tool("read_note", { note: "note" })).result.structuredContent.error.code, "service-required");
    const second = (await client.tool("read_note", { note: "note", service: b.config.service.href })).result.structuredContent;
    assert.equal(second.markdown, first.markdown);
    assert.notEqual(second.snapshot, first.snapshot);
    const wrongScope = (await client.tool("edit_note", { service: b.config.service.href,
      note: "note", expected_snapshot: first.snapshot, edits: [{ old_text: "world", new_text: "wrong" }] })).result;
    assert.equal(wrongScope.structuredContent.outcome, "stale-snapshot");
    assert.equal(b.operations, 0);
    const edit = (await client.tool("edit_note", { service: b.config.service.href,
      note: "note", expected_snapshot: second.snapshot, edits: [{ old_text: "world", new_text: "second service" }] })).result;
    assert.equal(edit.isError, false);
    assert.equal(edit.structuredContent.service, b.config.service.href);
    assert.equal(edit.structuredContent.markdown, "Hello 😀 second service\r\n");
    const unchanged = (await client.tool("read_note", { note: "note", service: a.config.service.href.slice(0, -1) })).result;
    assert.equal(unchanged.structuredContent.markdown, first.markdown);
    assert.equal((await client.tool("get_note_info", { note: "note", service: b.config.service.href })).result.structuredContent.service, b.config.service.href);
    assert.equal((await client.tool("read_note", { note: "note", service: unsaved.config.service.href })).result.structuredContent.error.code, "authentication-required");
    assert.equal(unsaved.requests.length, 0);
    assert(a.requests.some(r => r.cookie.includes(a.nextCookie)));
    assert(b.requests.some(r => r.cookie.includes(b.nextCookie)));
    assert(b.requests.filter(r => r.cookie).every(r => r.cookie.startsWith("custom.sid=")));
    assert(a.requests.every(r => !r.cookie.includes(b.nextCookie)));
    assert(b.requests.every(r => !r.cookie.includes(a.nextCookie)));
    // Independent service queues can both submit while awaiting acknowledgements.
    a.mode = b.mode = "silent";
    const pending = [a, b].map((f, i) => client!.tool("edit_note", {
      service: f.config.service.href, note: "note",
      expected_snapshot: i ? edit.structuredContent.persisted_snapshot : first.snapshot,
      edits: [{ old_text: "Hello", new_text: "Goodbye" }],
    }));
    for (let i = 0; (a.operations < 1 || b.operations < 2) && i < 200; i++)
      await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(a.operations, 1); assert.equal(b.operations, 2);
    client.child.kill("SIGTERM");
    for (const response of await Promise.all(pending))
      assert.equal(response.result.structuredContent.outcome, "uncertain");
    await client.stop();
    assert.equal(a.sockets.size, 0); assert.equal(b.sockets.size, 0);
    a.mode = b.mode = "normal";
    client = new McpProcess(a, env); await client.initialize();
    assert.equal((await client.tool("read_note", { note: "note", service: b.config.service.href })).result.isError, false);
    await local(["logout", b.config.service.href]);
    await assert.rejects(readFile(b.config.sessionFile), { code: "ENOENT" });
    assert.equal((await client.tool("read_note", { note: "note", service: a.config.service.href })).result.isError, false);
    assert.equal((await client.tool("read_note", { note: "note", service: b.config.service.href })).result.isError, true);
    assert.equal((await client.tool("list_services", {})).result.structuredContent.services.length, 1);
    assert(!(client.stdout + client.stderr).includes(a.nextCookie));
    assert(!(client.stdout + client.stderr).includes(b.nextCookie));
  } finally {
    await client?.stop();
    for (const f of fixtures) await f.close();
    await rm(directory, { recursive: true, force: true });
  }
});
