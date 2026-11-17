import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

export class HogletError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export interface Config {
  service: URL;
  release: "1.10.3" | "1.12.0";
  sessionFile: string;
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
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || /%|\\|\/\//.test(url.pathname))
    throw new HogletError("configuration", "Use a service origin with an optional plain deployment prefix.");
  url.pathname = url.pathname.replace(/\/?$/, "/");
  return url;
}

export function configFromEnv(env = process.env): Config {
  if (!env.HOGLET_SERVICE) throw new HogletError("configuration", "Set HOGLET_SERVICE to the HedgeDoc base URL.");
  let service: URL;
  try { service = serviceUrl(env.HOGLET_SERVICE); }
  catch { throw new HogletError("configuration", "HOGLET_SERVICE must be an HTTP(S) origin with an optional plain prefix."); }
  const release = env.HOGLET_RELEASE ?? "1.10.3";
  if (release !== "1.10.3" && release !== "1.12.0")
    throw new HogletError("unsupported-release", "Prototype profiles: 1.10.3 and 1.12.0.");
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
    service, release, cookieName,
    sessionFile: env.HOGLET_SESSION_FILE ?? join(homedir(), ".local/share/hoglet", key, "session.json"),
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
