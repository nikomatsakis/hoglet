// Disposable loopback service only. Direct HTTP creation is fixture setup,
// not an advertised Hoglet capability. Never prints cookie or password values.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { CookieJar } from "tough-cookie";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { configFromEnv, signalFor, snapshot } from "../dist/src/core.js";
import { Session } from "../dist/src/session.js";
import { LiveNote } from "../dist/src/realtime.js";
import { compileEdits } from "../dist/src/edits.js";

const config = configFromEnv();
assert(["127.0.0.1", "localhost", "[::1]"].includes(config.service.hostname), "Acceptance creates data; use a disposable loopback instance.");
const directory = await mkdtemp(join(tmpdir(), "hoglet-acceptance-"));
config.sessionFile = join(directory, "session.json");
const jar = new CookieJar();
async function request(path, init = {}) {
  const url = new URL(path, config.service);
  const response = await fetch(url, {
    ...init, redirect: "manual", signal: AbortSignal.timeout(10000),
    headers: { ...init.headers, cookie: await jar.getCookieString(url.href) },
  });
  for (const cookie of response.headers.getSetCookie()) await jar.setCookie(cookie, url.href);
  return response;
}
const client = new Client({ name: "hoglet-real-acceptance", version: "1" });
let second;
try {
  const email = "hoglet-" + randomUUID() + "@example.test", password = randomUUID();
  const form = new URLSearchParams({ email, password });
  const registration = await request("register", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
  assert.equal(registration.status, 302);
  const login = await request("login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
  assert.equal(login.status, 302);
  const identity = await (await request("me")).json();
  assert.equal(identity.status, "ok");
  const cookie = (await jar.getCookies(config.service.href)).find(c => c.key === config.cookieName);
  assert(cookie);
  const input = join(directory, "credential");
  await writeFile(input, cookie.cookieString(), { mode: 0o600 });
  const imported = spawn(process.execPath, ["dist/src/cli.js", "import-session", "--user-id", identity.id, "--file", input], {
    env: { ...process.env, HOGLET_SERVICE: config.service.href, HOGLET_RELEASE: config.release, HOGLET_SESSION_FILE: config.sessionFile },
  });
  let importOut = "", importErr = "";
  imported.stdout.on("data", x => { importOut += x; }); imported.stderr.on("data", x => { importErr += x; });
  const [code] = await once(imported, "exit"); assert.equal(code, 0, importErr); assert.equal(JSON.parse(importOut).id, identity.id);
  const markdown = "---\r\ntitle: Probe 😀\r\n---\r\nHello 😀 world\r\ne\u0301 stays\r\n";
  const created = await request("new", { method: "POST", headers: { "content-type": "text/markdown" }, body: markdown });
  assert.equal(created.status, 302);
  const note = new URL(created.headers.get("location"), config.service).pathname.split("/").at(-1);
  assert(note);
  const transport = new StdioClientTransport({
    command: process.execPath, args: ["dist/src/cli.js", "serve"], stderr: "pipe",
    env: { ...process.env, HOGLET_SERVICE: config.service.href, HOGLET_RELEASE: config.release, HOGLET_SESSION_FILE: config.sessionFile },
  });
  let diagnostics = "";
  transport.stderr?.on("data", x => { diagnostics += x; });
  await client.connect(transport);
  const tools = await client.listTools(); assert.equal(tools.tools.length, 3);
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    return result.structuredContent ?? JSON.parse(result.content[0].text);
  };
  const read = await call("read_note", { note });
  assert.equal(read.markdown, markdown.replaceAll("\r", ""));
  assert.equal(read.source, "persisted");
  const info = await call("get_note_info", { note }); assert.equal(info.title, "Probe 😀");
  const edit = await call("edit_note", {
    note, expected_snapshot: read.snapshot,
    edits: [{ old_text: "world", new_text: "HedgeDoc" }],
  });
  assert.equal(edit.outcome, "persisted-observed", JSON.stringify(edit));
  assert.equal(edit.markdown, read.markdown.replace("world", "HedgeDoc"));
  assert.equal(edit.acceptance, "acknowledged");
  const stored = await call("read_note", { note }); assert.equal(stored.markdown, edit.markdown);
  const session = new Session(config); await session.load();
  second = new LiveNote(config, note, await session.cookie(new URL("socket.io/", config.service)));
  await second.connect(signalFor(4000));
  second.submit(compileEdits(second.text, [{ old_text: "Hello", new_text: "Collaborator" }], config.maxBytes));
  await second.wait(() => second.accepted, signalFor(4000));
  const stale = await call("edit_note", { note, expected_snapshot: stored.snapshot, edits: [{ old_text: "HedgeDoc", new_text: "again" }] });
  assert.equal(stale.outcome, "stale-snapshot");
  assert.equal(stale.submitted, false); assert.equal(stale.markdown.includes("Collaborator"), true);
  assert.equal(stale.snapshot, snapshot(config, note, second.text));
  assert(!diagnostics.includes(cookie.value));
  console.log(JSON.stringify({
    release: config.release, authentication: "disposable email account (not GitHub)",
    results: ["actual MCP initialization and all tools", "development session import", "raw Unicode/frontmatter read",
      "UTF-16 edit and named ack", "database-backed readback", "second-editor change and stale rejection"],
    status: "passed",
  }, null, 2));
} finally {
  second?.close(); await client.close(); await rm(directory, { recursive: true, force: true });
}
