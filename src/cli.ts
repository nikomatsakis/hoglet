#!/usr/bin/env node
import { open, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { configFromEnv, HogletError, requireSupportedRuntime, safeError, signalFor } from "./core.js";
import { authHelpText, helpText, skillText } from "./guidance.js";

async function main() {
  requireSupportedRuntime();
  const [command = "help", ...args] = process.argv.slice(2);
  const noteCommands = ["services", "read", "info", "edit"];
  const commands = ["mcp", "serve", "auth", "login", "import-session", "logout"];
  const beforeEnd = args.includes("--") ? args.slice(0, args.indexOf("--")) : args;
  if (command === "help" || command === "--help" ||
      ([...commands, ...noteCommands, "install-browser", "skill"].includes(command) && beforeEnd.includes("--help"))) {
    console.log(["auth", "login", "import-session"].includes(command) ? authHelpText : helpText);
    return;
  }
  if (command === "skill") {
    if (args.length) throw new HogletError("usage", "Run hoglet skill without arguments.");
    console.log(skillText);
    return;
  }
  if (command === "--version") {
    if (args.length) throw new HogletError("usage", "Run hoglet --version without arguments.");
    const pkg = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
    console.log(`hoglet ${pkg.version} (Node ${process.versions.node})`);
    return;
  }
  if (command === "install-browser") {
    if (args.length) throw new HogletError("usage", "Run hoglet install-browser without arguments.");
    const cli = fileURLToPath(new URL("cli.js", import.meta.resolve("playwright/package.json")));
    process.exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(process.execPath, [cli, "install", "chromium"], { stdio: "inherit" });
      const interrupt = () => child.kill("SIGINT");
      const terminate = () => child.kill("SIGTERM");
      process.once("SIGINT", interrupt); process.once("SIGTERM", terminate);
      child.on("error", reject);
      child.on("close", code => {
        process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", terminate);
        resolve(code ?? 1);
      });
    });
    return;
  }
  if (noteCommands.includes(command)) {
    const { runNoteCommand } = await import("./note-cli.js");
    try { await runNoteCommand(command, args); }
    catch (error) { console.error(JSON.stringify({ error: safeError(error) })); process.exitCode = 1; }
    return;
  }
  const [{ Session, assertPrivate }, { ServiceHttp }, { browserLogin }, { Services }, { serve }] =
    await Promise.all([
      import("./session.js"), import("./http.js"), import("./login.js"),
      import("./services.js"), import("./mcp.js"),
    ]);
  if (!commands.includes(command)) throw new HogletError("usage", "Unknown local command; run hoglet help.");
  const allowed = command === "import-session" ? ["--user-id", "--file"]
    : command === "auth" || command === "login" ? ["--user-id"] : [];
  const options = new Map<string, string>();
  let serviceInput: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!key.startsWith("--")) {
      if (serviceInput !== undefined) throw new HogletError("usage", "Supply only one server hostname or base URL.");
      serviceInput = key;
    } else {
      const value = args[++i];
      if (!allowed.includes(key) || options.has(key) || !value || value.startsWith("--"))
        throw new HogletError("usage", "Invalid or incomplete arguments; run hoglet help.");
      options.set(key, value);
    }
  }
  const userId = options.get("--user-id");
  if ((userId !== undefined && !/^[A-Za-z0-9_-]{1,200}$/.test(userId)) ||
      ((command === "login" || command === "import-session") && !userId))
    throw new HogletError("usage", "Provisioning requires --user-id with the intended HedgeDoc user ID; auth can discover it automatically.");
  if (command === "mcp" || command === "serve") {
    await serve(new Services(process.env, serviceInput));
    return;
  }
  const config = configFromEnv(process.env, serviceInput);
  const session = new Session(config);
  if (command === "logout") {
    await session.logout(); console.log("Local session removed.");
  } else if (command === "auth" || command === "login" || command === "import-session") {
    if (command !== "import-session") {
      console.error("Complete the service's GitHub login in the browser. Only the HedgeDoc session will be saved.");
      const cancel = new AbortController();
      const stop = () => cancel.abort();
      process.once("SIGINT", stop); process.once("SIGTERM", stop);
      try { console.log(JSON.stringify(await browserLogin(config, userId, { signal: cancel.signal }))); }
      finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
    } else {
      let cookie = "";
      const path = options.get("--file");
      if (path !== undefined) {
        await assertPrivate(path);
        const file = await open(path, "r");
        try {
          if ((await file.stat()).size > 8192) throw new HogletError("invalid-session", "Import exceeds the credential limit.");
          cookie = await file.readFile("utf8");
        } finally { await file.close(); }
      } else {
        if (process.stdin.isTTY) throw new HogletError("usage", "Supply the cookie via protected file or piped stdin.");
        for await (const chunk of process.stdin) {
          cookie += chunk.toString();
          if (Buffer.byteLength(cookie) > 8192) throw new HogletError("invalid-session", "Import exceeds the credential limit.");
        }
      }
      await session.provision(cookie.trim(), userId!);
      const me = await new ServiceHttp(config, session).identity(signalFor(config.callMs));
      await session.save(); console.log(JSON.stringify(me));
    }
  } else throw new HogletError("usage", "Unknown local command; run hoglet help.");
}

main().catch(e => {
  console.error(JSON.stringify(safeError(e)));
  process.exitCode = 1;
});
