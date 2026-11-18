import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

export class HogletError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export function requireSupportedRuntime(version = process.versions.node): void {
  const [major, minor] = version.split(".").map(Number);
  if (major !== 24 || minor < 15 || !Number.isInteger(minor))
    throw new HogletError("unsupported-runtime",
      `Hoglet requires Node.js >=24.15.0 <25; running ${version}. Select Node 24.15.0 before retrying. With Volta: volta run --node 24.15.0 --npm 11.12.1 npm run auth SERVER.`);
}

export interface Config {
  service: URL;
  release: "1.10.3" | "1.12.0";
  sessionFile: string;
  credentialStore: "file" | "keychain";
  anonymous: boolean;
  cookieName: string;
  callMs: number;
  connectMs: number;
  ackMs: number;
  persistMs: number;
  shutdownMs: number;
  maxBytes: number;
}

export function serviceUrl(input: string): URL {
  if (!input || /[\s\\]/.test(input))
    throw new HogletError("configuration", "Use a service origin with an optional plain deployment prefix.");
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || /%|\\|\/\//.test(url.pathname))
    throw new HogletError("configuration", "Use a service origin with an optional plain deployment prefix.");
  url.pathname = url.pathname.replace(/\/?$/, "/");
  return url;
}

export function serviceArgument(input: string): URL {
  try { return serviceUrl(input.includes("://") ? input : "https://" + input); }
  catch { throw new HogletError("configuration", "Use a server hostname or HTTP(S) base URL with an optional plain prefix."); }
}

export function dataDirectory(env = process.env): string {
  const root = env.XDG_DATA_HOME;
  return join(root && isAbsolute(root) ? root : join(homedir(), ".local/share"), "hoglet");
}

export function configFromEnv(env = process.env, serviceInput?: string): Config {
  if (serviceInput === undefined && !env.HOGLET_SERVICE)
    throw new HogletError("configuration", "Supply a server hostname/base URL or set HOGLET_SERVICE.");
  let service: URL;
  try { service = serviceInput === undefined ? serviceUrl(env.HOGLET_SERVICE!) : serviceArgument(serviceInput); }
  catch { throw new HogletError("configuration", "HOGLET_SERVICE must be an HTTP(S) origin with an optional plain prefix."); }
  const release = env.HOGLET_RELEASE ?? "1.10.3";
  if (release !== "1.10.3" && release !== "1.12.0")
    throw new HogletError("unsupported-release", "Prototype profiles: 1.10.3 and 1.12.0.");
  const credentialStore = env.HOGLET_CREDENTIAL_STORE ?? (process.platform === "darwin" ? "keychain" : "file");
  if (!["file", "keychain"].includes(credentialStore) ||
      (credentialStore === "keychain" && process.platform !== "darwin"))
    throw new HogletError("configuration", "Use file credential storage, or keychain on macOS.");
  const number = (name: string, fallback: number, max: number) => {
    const n = Number(env[name] ?? fallback);
    if (!Number.isSafeInteger(n) || n < 1 || n > max)
      throw new HogletError("configuration", `Invalid ${name}.`);
    return n;
  };
  const cookieName = env.HOGLET_COOKIE_NAME ?? "connect.sid";
  if (!/^[A-Za-z0-9_.-]+$/.test(cookieName))
    throw new HogletError("configuration", "Invalid cookie name.");
  const key = createHash("sha256").update(service.href).digest("hex").slice(0, 20);
  return {
    service, release, cookieName, credentialStore: credentialStore as Config["credentialStore"],
    sessionFile: env.HOGLET_SESSION_FILE ?? join(dataDirectory(env), key, "session.json"),
    anonymous: env.HOGLET_ANONYMOUS === "1",
    callMs: number("HOGLET_CALL_MS", 15000, 120000),
    connectMs: number("HOGLET_CONNECT_MS", 4000, 60000),
    ackMs: number("HOGLET_ACK_MS", 4000, 60000),
    persistMs: number("HOGLET_PERSIST_MS", 4000, 60000),
    shutdownMs: number("HOGLET_SHUTDOWN_MS", 2000, 10000),
    maxBytes: number("HOGLET_MAX_BYTES", 1048576, 10485760),
  };
}

// A-notes-faithful-content:snapshot-provenance; A-service-contained-requests:request-boundaries
export function noteSelector(input: string): string {
  if (!/^[\p{L}\p{N}_-][\p{L}\p{N}_. -]{0,199}$/u.test(input) ||
      input === "." || input === ".." || !input.isWellFormed())
    throw new HogletError("invalid-note", "Use one note identifier or alias, not a URL or path.");
  return input;
}

export function snapshot(config: Config, note: string, markdown: string): string {
  return "sha256:" + createHash("sha256")
    .update(JSON.stringify([config.service.href, note, markdown])).digest("hex");
}

export function signalFor(ms: number, parent?: AbortSignal): AbortSignal {
  return parent ? AbortSignal.any([parent, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);
}

export function interrupted(signal: AbortSignal): void {
  if (signal.aborted) throw new HogletError("observation-ended", "Deadline or cancellation ended observation.");
}

export async function delay(ms: number, signal: AbortSignal): Promise<void> {
  interrupted(signal);
  await new Promise<void>((resolve, reject) => {
    const done = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); };
    const abort = () => { done(); reject(new HogletError("observation-ended", "Deadline or cancellation ended observation.")); };
    const timer = setTimeout(() => { done(); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function safeError(error: unknown): { code: string; message: string } {
  return error instanceof HogletError
    ? { code: error.code, message: error.message }
    : { code: "service-failure", message: "Service or local operation failed; no upstream error details are exposed." };
}
