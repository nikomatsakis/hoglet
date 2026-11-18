import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readlink, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [prefix, runtime, browser, runtimeSha] = process.argv.slice(2);
const root = join(prefix, "lib/hoglet");
const releases = join(root, "releases");
const command = join(prefix, "bin/hoglet");
const current = join(root, "current");
const commandTarget = "../lib/hoglet/current/bin/hoglet";
let stage, published, lock;

async function run(executable, args, cwd, capture = false) {
  const env = { ...process.env, PATH: join(runtime, "bin") + ":" + process.env.PATH };
  for (const key of Object.keys(env))
    if (/^npm_config_/i.test(key) || key === "NODE_OPTIONS" || key === "NODE_PATH") delete env[key];
  return await new Promise((accept, reject) => {
    const child = spawn(executable, args, {
      cwd, env, stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    });
    let output = "";
    child.stdout?.on("data", chunk => { output += chunk; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? accept(output.trim()) : reject(new Error(`Command failed (${code}): ${args[0]}`)));
  });
}

async function existingLink(path) {
  try { return await readlink(path); }
  catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw new Error(`Refusing to replace an unmanaged file or directory: ${path}`);
  }
}

async function replaceLink(path, target) {
  const temporary = path + ".new-" + randomUUID();
  try { await symlink(target, temporary); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}

try {
  if (process.versions.node !== "24.15.0") throw new Error("Installer requires its pinned private Node.");
  const node = join(runtime, "bin/node");
  const npm = join(runtime, "lib/node_modules/npm/bin/npm-cli.js");
  if (await run(node, [npm, "--version"], source, true) !== "11.12.1")
    throw new Error("Private runtime does not contain the pinned npm.");
  await mkdir(releases, { recursive: true });
  await mkdir(join(prefix, "bin"), { recursive: true });
  lock = join(root, "install.lock");
  try { await mkdir(lock); }
  catch { lock = undefined; throw new Error("Another installation holds install.lock; wait for it to finish."); }
  const priorCommand = await existingLink(command);
  const priorCurrent = await existingLink(current);
  if (priorCommand !== undefined && priorCommand !== commandTarget)
    throw new Error(`Refusing to replace an unrelated command: ${command}`);
  if (priorCurrent !== undefined && !/^releases\/[A-Za-z0-9._-]+$/.test(priorCurrent))
    throw new Error(`Refusing to replace an unrelated installation: ${current}`);

  stage = await mkdtemp(join(releases, ".build-"));
  const app = join(stage, "app");
  await mkdir(app);
  // Explicit inputs exclude sessions, test helpers, private files and the checkout.
  for (const file of ["package.json", "package-lock.json", "tsconfig.json", "src"])
    await cp(join(source, file), join(app, file), { recursive: true });
  for (const file of ["README.md", "THIRD_PARTY_NOTICES.md"])
    await cp(join(source, file), join(stage, file));
  await cp(runtime, join(stage, "runtime"), { recursive: true });
  const userConfig = join(stage, ".npm-userconfig");
  const globalConfig = join(stage, ".npm-globalconfig");
  await Promise.all([writeFile(userConfig, ""), writeFile(globalConfig, "")]);
  const npmArgs = [npm, `--userconfig=${userConfig}`, `--globalconfig=${globalConfig}`, "--no-audit", "--no-fund", "--ignore-scripts"];
  console.error("Building Hoglet with private Node 24.15.0 and npm 11.12.1…");
  await run(node, [...npmArgs, "ci"], app);
  await run(node, [join(app, "node_modules/typescript/bin/tsc")], app);
  await run(node, [...npmArgs, "prune", "--omit=dev"], app);
  await Promise.all([rm(userConfig), rm(globalConfig)]);
  await rm(join(app, "src"), { recursive: true });
  await rm(join(app, "tsconfig.json"));
  await mkdir(join(stage, "bin"));
  await cp(join(source, "scripts/hoglet-launcher.sh"), join(stage, "bin/hoglet"));
  const { chmod } = await import("node:fs/promises");
  await chmod(join(stage, "bin/hoglet"), 0o755);
  const pkg = JSON.parse(await readFile(join(app, "package.json"), "utf8"));
  const fingerprint = createHash("sha256");
  for (const file of ["package.json", "package-lock.json", "scripts/hoglet-launcher.sh"])
    fingerprint.update(await readFile(join(source, file)));
  await writeFile(join(stage, "distribution.json"), JSON.stringify({
    version: pkg.version, node: process.versions.node, npm: "11.12.1",
    platform: process.platform, arch: process.arch, runtime_sha256: runtimeSha,
    packaging_sha256: fingerprint.digest("hex"),
  }, null, 2) + "\n");
  await run(join(stage, "bin/hoglet"), ["--version"], stage);
  if (browser === "install")
    await run(join(stage, "bin/hoglet"), ["install-browser"], stage);
  const release = `${pkg.version}-${process.platform}-${process.arch}-${randomUUID()}`;
  published = join(releases, release);
  await rename(stage, published); stage = undefined;
  await replaceLink(current, "releases/" + release);
  // The selector now owns this release, including if command publication fails.
  published = undefined;
  await replaceLink(command, commandTarget);
  console.error(`Installed: ${command}\nAuthenticate: ${command} auth hedgedoc.nikomatsakis.com\nMCP command: ${command} mcp\nAdd ${join(prefix, "bin")} to PATH to use the short command. Earlier releases are retained.`);
} catch (error) {
  console.error("Hoglet installation failed: " + error.message);
  process.exitCode = 1;
} finally {
  if (stage) await rm(stage, { recursive: true, force: true });
  if (published) await rm(published, { recursive: true, force: true });
  if (lock) await rm(lock, { recursive: true, force: true });
}
