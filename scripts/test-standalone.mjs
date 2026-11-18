import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, cp, mkdtemp, readFile, readlink, rename, rm, stat, symlink, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Fixture, SECRET } from "../dist/test/fixture.js";
import { Session } from "../dist/src/session.js";
import { configFromEnv } from "../dist/src/core.js";

// A-mcp-independent-install:standalone-runtime
// A-cli-note-operations:command-contracts
// Real installer / relocated launcher / native auth / installed stdio MCP.
const temporary = await mkdtemp(join(tmpdir(), "hoglet-standalone-"));
const source = resolve(".");
const prefix = join(temporary, "first install");
const moved = join(temporary, "moved install");
const outside = join(temporary, "outside");
const shadow = join(temporary, "shadow");
const configs = [];
const fixtures = [];
const client = new Client({ name: "standalone-acceptance", version: "1" });
let diagnostics = "";

async function run(command, args, env, cwd = outside, timeout = 300000) {
  return await new Promise((accept, reject) => {
    const child = spawn(command, args, { env, cwd, timeout });
    let out = "", err = "";
    child.stdout.on("data", chunk => { out += chunk; });
    child.stderr.on("data", chunk => { err += chunk; });
    child.on("error", reject);
    child.on("close", code => accept({ code, out, err }));
  });
}
function passed(result) { assert.equal(result.code, 0, result.err + result.out); }

try {
  await Promise.all([mkdir(shadow), mkdir(outside)]);
  if (process.env.HOGLET_LEGACY_NODE)
    await symlink(resolve(process.env.HOGLET_LEGACY_NODE), join(shadow, "node"));
  else {
    await writeFile(join(shadow, "node"), "#!/bin/sh\nexit 88\n");
    await chmod(join(shadow, "node"), 0o755);
  }
  await writeFile(join(shadow, "npm"), "#!/bin/sh\nexit 87\n");
  await chmod(join(shadow, "npm"), 0o755);
  const env = { ...process.env, PATH: shadow + ":/usr/bin:/bin:/usr/sbin:/sbin",
    NODE_OPTIONS: "--require /nonexistent/host-preload.js", NODE_PATH: "/nonexistent/host-modules",
    XDG_DATA_HOME: join(temporary, "data") };
  for (const key of ["HOGLET_SERVICE", "HOGLET_SESSION_FILE", "HOGLET_CREDENTIAL_STORE", "HOGLET_ANONYMOUS"])
    delete env[key];
  const corrupt = join(temporary, "corrupt-node.tar.gz");
  await writeFile(corrupt, "This is not a Node archive.");
  const rejected = await run(join(source, "install.sh"), ["--prefix", prefix, "--skip-browser"],
    { ...env, HOGLET_NODE_ARCHIVE: corrupt });
  assert.equal(rejected.code, 1);
  assert(rejected.err.includes("checksum mismatch"));

  const installed = await run(join(source, "install.sh"), ["--prefix", prefix, "--skip-browser"], env);
  passed(installed);
  const current = join(prefix, "lib/hoglet/current");
  const selected = await readlink(current);
  const failure = await run(join(source, "install.sh"), ["--prefix", prefix],
    { ...env, HOGLET_NODE_ARCHIVE: corrupt });
  assert.equal(failure.code, 1);
  assert.equal(await readlink(current), selected, "Failed update must preserve the working release");
  const broken = join(temporary, "broken source");
  await mkdir(join(broken, "scripts"), { recursive: true });
  for (const file of ["install.sh", "package.json", "package-lock.json", "tsconfig.json", "src", "README.md", "THIRD_PARTY_NOTICES.md",
    "scripts/install.mjs", "scripts/hoglet-launcher.sh"])
    await cp(join(source, file), join(broken, file), { recursive: true });
  await writeFile(join(broken, "src/packaging-failure.ts"), "const packagingFailure: never = 'synthetic-build-failure';\n");
  const buildFailure = await run(join(broken, "install.sh"), ["--prefix", prefix, "--skip-browser"], env);
  assert.equal(buildFailure.code, 1);
  assert(buildFailure.err.includes("installation failed"));
  assert.equal(await readlink(current), selected, "Failed build must preserve the working release");
  await assert.rejects(stat(join(prefix, "lib/hoglet/install.lock")), { code: "ENOENT" });
  const updated = await run(join(source, "install.sh"), ["--prefix", prefix, "--skip-browser"], env);
  passed(updated);
  assert.notEqual(await readlink(current), selected, "A completed update selects its new release");
  await stat(join(prefix, "lib/hoglet", selected, "runtime/bin/node"));
  const unrelated = join(temporary, "unrelated");
  await mkdir(join(unrelated, "bin"), { recursive: true });
  await writeFile(join(unrelated, "bin/hoglet"), "Do not overwrite.");
  const collision = await run(join(source, "install.sh"), ["--prefix", unrelated, "--skip-browser"], env);
  assert.equal(collision.code, 1);
  assert(collision.err.includes("unmanaged"));
  assert.equal(await readFile(join(unrelated, "bin/hoglet"), "utf8"), "Do not overwrite.");
  assert(!((await readFile(join(current, "app/package.json"), "utf8")).includes("SYNTHETIC-HOGLET")));
  await assert.rejects(stat(join(current, "app/src")), { code: "ENOENT" });
  await assert.rejects(stat(join(current, "app/node_modules/typescript")), { code: "ENOENT" });
  await stat(join(current, "runtime/LICENSE"));
  await stat(join(current, "app/node_modules/@napi-rs/keyring/LICENSE"));
  await rename(prefix, moved);
  const launcher = join(moved, "bin/hoglet");
  const version = await run(launcher, ["--version"], env);
  passed(version); assert.equal(version.out.trim(), "hoglet 0.1.0 (Node 24.15.0)");
  const bare = await run(launcher, [], { ...env, HOGLET_SERVICE: "invalid://configuration" });
  passed(bare); assert.equal(bare.err, "");
  const help = await run(launcher, ["--help"], env);
  passed(help); assert.equal(bare.out, help.out); assert(help.out.includes("mcp [SERVER]"));
  assert(help.out.includes("Use `hoglet skill` to get instructions."));
  const skill = await run(launcher, ["skill"], { ...env, HOGLET_SERVICE: "invalid://configuration" });
  passed(skill); assert.equal(skill.err, "");
  assert(skill.out.startsWith("# Using Hoglet\n"));
  assert(skill.out.includes("do not run auth before every operation"));
  assert(skill.out.includes("Never blindly retry accepted or uncertain writes"));
  console.log("standalone-runtime: verified archive, private Node/npm build, failed-update preservation and relocation passed.");

  // No npm, checkout paths or compatible system Node in this installed workflow.
  passed(await run(launcher, ["install-browser"], env));
  for (const release of ["1.10.3", "1.12.0"]) {
    const fixture = new Fixture(release);
    fixtures.push(fixture);
    await fixture.start(join(temporary, "unused-" + release));
    const cfg = configFromEnv(env, fixture.config.service.href); configs.push(cfg);
    const auth = await run(launcher, ["auth", fixture.config.service.href],
      { ...env, HOGLET_RELEASE: release }, outside, 30000);
    passed(auth);
    assert.deepEqual(JSON.parse(auth.out), { id: "user-1", name: "Synthetic user" });
    assert(!(auth.out + auth.err).includes(SECRET));
    const metadata = await readFile(cfg.sessionFile, "utf8");
    if (process.platform === "darwin") {
      assert.equal(JSON.parse(metadata).schema, 2);
      assert(!metadata.includes(SECRET), "Installed auth must use native Keychain");
    }
    assert.equal((await stat(cfg.sessionFile)).mode & 0o777, 0o600);
    const service = fixture.config.service.href;
    const raw = await run(launcher, ["read", "note", "--service", service], env);
    passed(raw); assert.equal(raw.out, "Hello 😀 world\r\n"); assert.equal(raw.err, "");
    const read = await run(launcher, ["read", "note", "--service", service, "--json"], env);
    passed(read);
    const base = JSON.parse(read.out);
    assert.equal(base.markdown, raw.out); assert.equal(base.service, service);
    const info = await run(launcher, ["info", "note", "--service", service], env);
    passed(info); assert.equal(JSON.parse(info.out).title, "Test");
    assert.equal(JSON.parse(info.out).service, service);
    const replacements = join(temporary, "edits-" + release + ".json");
    await writeFile(replacements, JSON.stringify([{ old_text: "world", new_text: "CLI-bundled" }]));
    const edit = await run(launcher, ["edit", "note", "--service", service,
      "--snapshot", base.snapshot, "--edits", replacements], env);
    passed(edit); assert.equal(JSON.parse(edit.out).outcome, "persisted-observed");
    assert.equal(fixture.stored, "Hello 😀 CLI-bundled\r\n");
    for (const result of [raw, read, info, edit])
      assert(!(result.out + result.err).includes(SECRET));
  }
  const saved = await run(launcher, ["services"], env);
  passed(saved); assert.equal(JSON.parse(saved.out).services.length, 2);
  const transport = new StdioClientTransport({
    command: launcher, args: ["mcp"], cwd: outside, env, stderr: "pipe",
  });
  transport.stderr?.on("data", chunk => { diagnostics += chunk; });
  await client.connect(transport);
  const discovered = await client.callTool({ name: "list_services", arguments: {} });
  assert.equal(discovered.structuredContent.services.length, 2);
  for (const fixture of fixtures) {
    const service = fixture.config.service.href;
    const read = await client.callTool({ name: "read_note", arguments: { service, note: "note" } });
    assert.equal(read.isError, false);
    assert.equal(read.structuredContent.markdown, fixture.stored);
    const edit = await client.callTool({ name: "edit_note", arguments: {
      service, note: "note", expected_snapshot: read.structuredContent.snapshot,
      edits: [{ old_text: "CLI-bundled", new_text: "standalone" }],
    } });
    assert.equal(edit.isError, false, JSON.stringify(edit));
    assert.equal(edit.structuredContent.outcome, "persisted-observed");
    assert.equal(fixture.stored, "Hello 😀 standalone\r\n");
  }
  const loggedOut = await run(launcher, ["logout", configs[0].service.href], env);
  passed(loggedOut);
  const missingCli = await run(launcher, ["read", "note", "--service", configs[0].service.href], env);
  assert.equal(missingCli.code, 1);
  assert.equal(JSON.parse(missingCli.err).error.code, "authentication-required");
  const remainingCli = await run(launcher, ["read", "note", "--service", configs[1].service.href], env);
  passed(remainingCli); assert.equal(remainingCli.out, "Hello 😀 standalone\r\n");
  const missing = await client.callTool({ name: "read_note",
    arguments: { service: configs[0].service.href, note: "note" } });
  assert.equal(missing.isError, true);
  assert.equal((await client.callTool({ name: "read_note",
    arguments: { service: configs[1].service.href, note: "note" } })).isError, false);
  assert(!diagnostics.includes(SECRET));
  console.log("standalone-runtime: installed browser setup, visible synthetic auth, native storage, two-release CLI/MCP read/edit and scoped logout passed.");
} finally {
  await client.close();
  for (const cfg of configs) await new Session(cfg).logout();
  for (const fixture of fixtures) await fixture.close();
  await rm(temporary, { recursive: true, force: true });
}
