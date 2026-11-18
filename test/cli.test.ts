import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { configFromEnv, dataDirectory, requireSupportedRuntime } from "../src/core.js";

test("local auth CLI: runtime requirement covers the supported Node boundaries before loading Playwright", async () => {
  for (const version of ["24.15.0", "24.20.0", "24.99.0"])
    assert.doesNotThrow(() => requireSupportedRuntime(version));
  for (const version of ["18.20.2", "20.20.0", "22.0.0", "24.14.9", "25.0.0"])
    assert.throws(() => requireSupportedRuntime(version), {
      code: "unsupported-runtime",
      message: new RegExp(`running ${version.replaceAll(".", "\\.")}.*volta run`),
    });
  const directory = await mkdtemp(join(tmpdir(), "hoglet-runtime-"));
  try {
    const preload = join(directory, "node18.cjs");
    await writeFile(preload, "Object.defineProperty(process.versions, 'node', { value: '18.20.2' });");
    const result = await cli(["auth", "hedgedoc.example.test"], {
      NODE_OPTIONS: `--require ${JSON.stringify(preload)}`,
    });
    assert.equal(result.code, 1);
    assert.equal(result.out, "");
    const error = JSON.parse(result.err);
    assert.equal(error.code, "unsupported-runtime");
    assert(error.message.includes("18.20.2"));
    assert(error.message.includes("volta run"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

async function cli(args: string[], extra: NodeJS.ProcessEnv = {}) {
  const env = { ...process.env };
  delete env.HOGLET_SERVICE;
  delete env.HOGLET_SESSION_FILE;
  Object.assign(env, extra);
  const child = spawn(process.execPath, ["dist/src/cli.js", ...args], { env, timeout: 5000 });
  let out = "", err = "";
  child.stdout.on("data", chunk => { out += chunk; });
  child.stderr.on("data", chunk => { err += chunk; });
  const [code] = await once(child, "close");
  return { code, out, err };
}

test("CLI entry points: bare invocation prints help and exits before service configuration", async () => {
  const env = { HOGLET_SERVICE: "invalid://configuration", HOGLET_SESSION_FILE: "/nonexistent/session.json" };
  const help = await cli(["--help"], env);
  assert.equal(help.code, 0, help.err);
  assert(help.out.includes("mcp [SERVER]"));
  assert(help.out.includes("Start the stdio MCP server"));
  assert(help.out.includes("Use `hoglet skill` to get instructions."));
  assert(help.out.split("\n").length < 25);
  for (const args of [[], ["help"], ["mcp", "--help"], ["serve", "--help"], ["skill", "--help"]]) {
    const result = await cli(args, env);
    assert.equal(result.code, 0, result.err);
    assert.equal(result.out, help.out);
    assert.equal(result.err, "");
  }
});

test("local auth CLI: help and automatic identity need no copied user ID", async () => {
  const help = await cli(["auth", "--help"]);
  assert.equal(help.code, 0, help.err);
  assert(help.out.includes("auth [SERVER] [--user-id ID]"));
  const auth = await cli(["auth"]);
  assert.equal(auth.code, 1);
  assert.equal(JSON.parse(auth.err).code, "configuration");
  assert.equal(auth.out, "");
});

test("CLI skill: local workflow explains authentication, reuse and checked edits without service access", async () => {
  const result = await cli(["skill"], {
    HOGLET_SERVICE: "invalid://configuration", HOGLET_SESSION_FILE: "/nonexistent/session.json",
    HOGLET_RELEASE: "invalid", HOGLET_CREDENTIAL_STORE: "invalid",
  });
  assert.equal(result.code, 0, result.err);
  assert.equal(result.err, "");
  assert(result.out.startsWith("# Using Hoglet\n"));
  for (const instruction of [
    "hoglet services", "hoglet auth", "The user completes", "do not run auth before every operation",
    "outside MCP tools", "do not need to start an MCP server", "npm run auth SERVER",
    "--service SERVER", "--json", "actual `snapshot`", "--edits -", "expected_snapshot",
    "stale-snapshot", "accepted or uncertain", "Never blindly retry", "can lag",
  ]) assert(result.out.includes(instruction), instruction);
  const example = result.out.match(/```json\n([\s\S]*?)\n```/);
  assert(example, "the workflow includes a usable replacement array");
  assert.deepEqual(JSON.parse(example[1]), [{ old_text: "old phrase", new_text: "new phrase" }]);
});

test("CLI skill: unexpected arguments fail without echoing input or loading service configuration", async () => {
  const result = await cli(["skill", "SYNTHETIC-CLI-SECRET"], { HOGLET_SERVICE: "invalid://configuration" });
  assert.equal(result.code, 1);
  assert.equal(result.out, "");
  assert.equal(JSON.parse(result.err).code, "usage");
  assert(!result.err.includes("SYNTHETIC-CLI-SECRET"));
});

test("local auth CLI: version reports the actual runtime and installer command rejects arguments", async () => {
  const version = await cli(["--version"]);
  assert.equal(version.code, 0, version.err);
  assert.equal(version.out.trim(), `hoglet 0.1.0 (Node ${process.versions.node})`);
  const invalid = await cli(["install-browser", "SYNTHETIC-CLI-SECRET"]);
  assert.equal(invalid.code, 1);
  assert.equal(JSON.parse(invalid.err).code, "usage");
  assert(!invalid.err.includes("SYNTHETIC-CLI-SECRET"));
});
test("local auth CLI: invalid arguments fail before launching a browser without echoing secrets", async () => {
  for (const args of [
    ["auth", "--user-id"],
    ["auth", "--user-id", "--file"],
    ["auth", "--user-id", "bad/id"],
    ["auth", "--user-id", "user-1", "--user-id", "user-2"],
    ["auth", "server.test", "SYNTHETIC-CLI-SECRET"],
    ["auth", "--file", "SYNTHETIC-CLI-SECRET"],
    ["login"],
    ["import-session", "--user-id", "user-1", "--file"],
  ]) {
    const result = await cli(args);
    assert.equal(result.code, 1);
    assert.equal(JSON.parse(result.err).code, "usage");
    assert.equal(result.out, "");
    assert(!result.err.includes("SYNTHETIC-CLI-SECRET"));
  }
});

test("service configuration: hostname normalization and isolated XDG stores", () => {
  const env = { XDG_DATA_HOME: "/tmp/hoglet-test-data", HOGLET_SERVICE: "https://ignored.test/" };
  const a = configFromEnv(env, "HEDGEDOC.EXAMPLE.TEST");
  const same = configFromEnv(env, "https://hedgedoc.example.test:443/");
  assert.equal(a.service.href, "https://hedgedoc.example.test/");
  assert.equal(a.sessionFile, same.sessionFile);
  assert(a.sessionFile.startsWith("/tmp/hoglet-test-data/hoglet/"));
  for (const input of ["second.example.test", "https://hedgedoc.example.test/pad/",
    "http://hedgedoc.example.test", "https://hedgedoc.example.test:444/"]) {
    assert.notEqual(configFromEnv(env, input).sessionFile, a.sessionFile);
  }
  for (const input of ["ftp://server.test", "https://user:password@server.test",
    "https://server.test/?token=secret", "https://server.test/#fragment", "bad host.test"]) {
    assert.throws(() => configFromEnv(env, input), { code: "configuration" });
  }
  for (const root of [undefined, "", "relative/path"]) {
    assert.equal(dataDirectory({ XDG_DATA_HOME: root }), join(homedir(), ".local/share/hoglet"));
  }
});

test("local auth CLI: positional hostname and URL override the environment", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hoglet-select-"));
  try {
    for (const input of ["HEDGEDOC.EXAMPLE.TEST", "https://hedgedoc.example.test/pad/"]) {
      const result = await cli(["logout", input], {
        XDG_DATA_HOME: directory, HOGLET_SERVICE: "invalid://environment",
      });
      assert.equal(result.code, 0, result.err);
      assert.equal(result.out.trim(), "Local session removed.");
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
