#!/usr/bin/env node
import { open } from "node:fs/promises";
import { configFromEnv, HogletError, safeError, signalFor } from "./core.js";
import { Session, assertPrivate } from "./session.js";
import { ServiceHttp } from "./http.js";
import { browserLogin } from "./login.js";
import { Bridge } from "./bridge.js";
import { serve } from "./mcp.js";

async function main() {
  const [command = "serve", ...args] = process.argv.slice(2);
  if (command === "help" || command === "--help") {
    console.log("Hoglet: serve | login --user-id ID | import-session --user-id ID [--file PATH] | logout\nConfigure HOGLET_SERVICE and HOGLET_RELEASE (1.10.3 or 1.12.0). Import reads one cookie from stdin or an owner-only file. Install login browser: npx playwright install chromium.");
    return;
  }
  const config = configFromEnv();
  const userIndex = args.indexOf("--user-id");
  const userId = userIndex >= 0 ? args[userIndex + 1] : undefined;
  const session = new Session(config);
  if (command === "serve") {
    if (args.length) throw new HogletError("usage", "serve accepts no credential arguments.");
    if (!config.anonymous) await session.load();
    await serve(new Bridge(config, session));
  } else if (command === "logout") {
    await session.logout(); console.log("Local session removed.");
  } else if (command === "login" || command === "import-session") {
    if (!userId || !/^[A-Za-z0-9_-]{1,200}$/.test(userId))
      throw new HogletError("usage", "Provisioning requires --user-id with the intended HedgeDoc user ID.");
    if (command === "login") {
      console.error("Complete the service's GitHub login in the browser. Only the HedgeDoc session will be saved.");
      const cancel = new AbortController();
      const stop = () => cancel.abort();
      process.once("SIGINT", stop); process.once("SIGTERM", stop);
      try { console.log(JSON.stringify(await browserLogin(config, userId, { signal: cancel.signal }))); }
      finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
    } else {
      let cookie = "";
      const fileIndex = args.indexOf("--file");
      if (fileIndex >= 0) {
        const path = args[fileIndex + 1];
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
      await session.provision(cookie.trim(), userId);
      const me = await new ServiceHttp(config, session).identity(signalFor(config.callMs));
      await session.save(); console.log(JSON.stringify(me));
    }
  } else throw new HogletError("usage", "Unknown local command; run hoglet help.");
}

main().catch(e => {
  console.error(JSON.stringify(safeError(e)));
  process.exitCode = 1;
});
