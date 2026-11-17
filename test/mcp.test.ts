import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm, writeFile, stat, readFile } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
  constructor(f: Fixture) {
    this.child = spawn(process.execPath, ["dist/src/cli.js", "serve"], {
      cwd: resolve("."), env: {
        ...process.env, HOGLET_SERVICE: f.config.service.href, HOGLET_RELEASE: f.release,
        HOGLET_SESSION_FILE: f.config.sessionFile, HOGLET_CALL_MS: "700",
        HOGLET_CONNECT_MS: "250", HOGLET_ACK_MS: "250", HOGLET_PERSIST_MS: "250",
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

for (const release of ["1.10.3", "1.12.0"] as const) {
  test(`MCP ${release}: initialize/discover/all tools/errors, pure protocol stdout`, () => fixtureProcess(release, async (f, c) => {
    const list = await c.call("tools/list", {});
    assert.deepEqual(list.result.tools.map((t: any) => t.name), ["read_note", "get_note_info", "edit_note"]);
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
      env: { ...process.env, HOGLET_SERVICE: f.config.service.href, HOGLET_SESSION_FILE: f.config.sessionFile },
    });
    let out = "", err = ""; child.stdout.on("data", c => { out += c; }); child.stderr.on("data", c => { err += c; });
    const [code] = await once(child, "exit"); assert.equal(code, 0, err);
    assert.deepEqual(JSON.parse(out), { id: "user-1", name: "Synthetic user" }); assert(!out.includes(SECRET)); assert(!err.includes(SECRET));
    assert.equal((await stat(f.config.sessionFile)).mode & 0o777, 0o600);
    const record = JSON.parse(await readFile(f.config.sessionFile, "utf8"));
    assert.equal(record.cookies.length, 1); assert.equal(record.cookies[0].key, "connect.sid");
  } finally { await f.close(); await rm(directory, { recursive: true, force: true }); }
});
