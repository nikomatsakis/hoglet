import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, lstat, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CookieJar, Cookie } from "tough-cookie";
import { z } from "zod";
import { type Config, HogletError } from "./core.js";

const Record = z.object({
  schema: z.literal(1), service: z.string(), user_id: z.string().min(1),
  cookies: z.array(z.object({
    key: z.string(), value: z.string(), path: z.string(),
    secure: z.boolean(), httpOnly: z.boolean(),
    expires: z.string().optional(),
  }).strict()).min(1).max(8),
}).strict();

// A-service-private-credentials:credential-flow
export async function assertPrivate(path: string, directory = false): Promise<void> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) ||
      (stat.mode & 0o077) || stat.uid !== process.getuid?.())
    throw new HogletError("session-storage", "Session paths must belong to the user and deny group/other access.");
}

export class Session {
  jar = new CookieJar();
  userId?: string;
  generation = 0;
  private storedText?: string;
  private saveTail = Promise.resolve();
  constructor(public config: Config) {}

  async load(): Promise<void> {
    try {
      await assertPrivate(dirname(this.config.sessionFile), true);
      await assertPrivate(this.config.sessionFile);
      const file = await open(this.config.sessionFile, constants.O_RDONLY | constants.O_NOFOLLOW);
      let text: string;
      try {
        if ((await file.stat()).size > 16384) throw new HogletError("session-storage", "Session record is too large.");
        text = await file.readFile("utf8");
      } finally { await file.close(); }
      const data = Record.parse(JSON.parse(text));
      if (data.service !== this.config.service.href)
        throw new HogletError("session-storage", "Session belongs to a different service.");
      const previous = await this.cookie(this.config.service);
      this.jar = new CookieJar();
      for (const c of data.cookies) {
        if (c.key !== this.config.cookieName || !c.path.startsWith("/") || !this.config.service.pathname.startsWith(c.path))
          throw new HogletError("session-storage", "Session credential has an unsupported scope.");
        await this.jar.setCookie(new Cookie({
          ...c, expires: c.expires ? new Date(c.expires) : "Infinity",
          hostOnly: true, domain: this.config.service.hostname,
        }), this.config.service.href);
      }
      this.userId = data.user_id;
      this.storedText = text;
      if (previous !== await this.cookie(this.config.service)) this.generation++;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      if (e instanceof HogletError) throw e;
      throw new HogletError("session-storage", "Session record is invalid or unreadable.");
    }
  }

  async checkStore(): Promise<void> {
    if (this.storedText === undefined) return; // Provisioning validates before first save.
    try {
      await assertPrivate(this.config.sessionFile);
      const file = await open(this.config.sessionFile, constants.O_RDONLY | constants.O_NOFOLLOW);
      let text: string;
      try {
        if ((await file.stat()).size > 16384) throw new HogletError("session-storage", "Session record is too large.");
        text = await file.readFile("utf8");
      } finally { await file.close(); }
      if (text !== this.storedText) {
        const expectedUser = this.userId;
        await this.load();
        if (this.userId !== expectedUser)
          throw new HogletError("identity-changed", "Local provisioning changed the intended user; restart the MCP process.");
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        throw new HogletError("authentication-required", "Local session was removed; run login before authenticated calls.");
      throw e;
    }
  }

  async cookie(url: URL): Promise<string> {
    if (url.origin !== this.config.service.origin)
      throw new HogletError("request-boundary", "Credential destination is outside the service.");
    return this.jar.getCookieString(url.href);
  }

  async accept(headers: Headers, url: URL): Promise<void> {
    const before = await this.cookie(this.config.service);
    for (const header of headers.getSetCookie()) {
      const c = Cookie.parse(header);
      if (!c || c.key !== this.config.cookieName) continue;
      // Never keep domain cookies that could also be forwarded to another service.
      if (c.domain && c.domain !== this.config.service.hostname) continue;
      c.domain = this.config.service.hostname; c.hostOnly = true;
      if (!c.path || !this.config.service.pathname.startsWith(c.path)) continue;
      try { await this.jar.setCookie(c, url.href); } catch { /* Ignore unusable service cookies. */ }
    }
    if (before !== await this.cookie(this.config.service)) this.generation++;
    if (this.userId && headers.getSetCookie().length) await this.save();
  }

  async provision(cookie: string, userId: string): Promise<void> {
    if (!cookie.startsWith(this.config.cookieName + "=") || /[\r\n;]/.test(cookie) || cookie.length > 8192)
      throw new HogletError("invalid-session", "Import exactly one configured HedgeDoc session cookie.");
    await this.jar.setCookie(new Cookie({
      key: this.config.cookieName, value: cookie.slice(this.config.cookieName.length + 1),
      path: "/", secure: this.config.service.protocol === "https:", httpOnly: true,
      domain: this.config.service.hostname, hostOnly: true,
    }), this.config.service.href);
    this.userId = userId;
    this.generation++;
  }

  save(): Promise<void> {
    const job = this.saveTail.then(async () => {
      if (!this.userId) throw new HogletError("authentication-required", "Run the local login or import-session command.");
      const directory = dirname(resolve(this.config.sessionFile));
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await assertPrivate(directory, true);
      const cookies = (await this.jar.getCookies(this.config.service.href)).map(c => ({
        key: c.key, value: c.value, path: c.path ?? "/", secure: c.secure, httpOnly: c.httpOnly,
        ...(c.expires instanceof Date ? { expires: c.expires.toISOString() } : {}),
      }));
      const text = JSON.stringify({ schema: 1, service: this.config.service.href, user_id: this.userId, cookies }) + "\n";
      const temporary = resolve(directory, ".session-" + randomUUID());
      const file = await open(temporary, "wx", 0o600);
      try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
      try { await rename(temporary, this.config.sessionFile); }
      finally { await unlink(temporary).catch(() => {}); }
      this.storedText = text;
    });
    this.saveTail = job.catch(() => {});
    return job;
  }

  invalidate(): void { this.userId = undefined; this.jar = new CookieJar(); this.generation++; }
  async logout(): Promise<void> { this.invalidate(); await this.saveTail; await unlink(this.config.sessionFile).catch(e => { if (e.code !== "ENOENT") throw e; }); }
}
