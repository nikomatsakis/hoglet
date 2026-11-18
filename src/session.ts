import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, lstat, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CookieJar, Cookie } from "tough-cookie";
import { z } from "zod";
import { type Config, HogletError } from "./core.js";
import { MacKeychain, type Credentials } from "./keychain.js";

const profile = {
  service: z.string(), user_id: z.string().min(1),
  release: z.enum(["1.10.3", "1.12.0"]).optional(),
  cookie_name: z.string().regex(/^[A-Za-z0-9_.-]+$/).optional(),
};
const CredentialRecord = z.object({
  ...profile, schema: z.literal(1),
  cookies: z.array(z.object({
    key: z.string(), value: z.string(), path: z.string(),
    secure: z.boolean(), httpOnly: z.boolean(),
    expires: z.string().optional(),
  }).strict()).min(1).max(8),
}).strict();
const KeychainRecord = z.object({
  ...profile, schema: z.literal(2), credential_store: z.literal("macos-keychain"),
  credential_ref: z.string().uuid(),
}).strict();
const Record = z.discriminatedUnion("schema", [CredentialRecord, KeychainRecord]);

// A-service-private-credentials:credential-flow
export async function assertPrivate(path: string, directory = false): Promise<void> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) ||
      (stat.mode & 0o077) || stat.uid !== process.getuid?.())
    throw new HogletError("session-storage", "Session paths must belong to the user and deny group/other access.");
}

export async function readSessionRecord(path: string) {
  try {
    await assertPrivate(dirname(path), true);
    await assertPrivate(path);
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    let text: string;
    try {
      if ((await file.stat()).size > 16384) throw new HogletError("session-storage", "Session record is too large.");
      text = await file.readFile("utf8");
    } finally { await file.close(); }
    return { text, data: Record.parse(JSON.parse(text)) };
  } catch (e) {
    if (e instanceof HogletError || (e as NodeJS.ErrnoException).code === "ENOENT") throw e;
    throw new HogletError("session-storage", "Session record is invalid or unreadable.");
  }
}

export class Session {
  jar = new CookieJar();
  userId?: string;
  generation = 0;
  private storedText?: string;
  private credentialRef?: string;
  private saveTail = Promise.resolve();
  constructor(public config: Config, private credentials: Credentials = new MacKeychain()) {}

  private account(reference: string): string { return this.config.service.href + " " + reference; }

  async load(): Promise<void> {
    let found = false;
    try {
      const { data: saved, text } = await readSessionRecord(this.config.sessionFile);
      found = true;
      if (saved.service !== this.config.service.href)
        throw new HogletError("session-storage", "Session belongs to a different service.");
      let data: z.infer<typeof CredentialRecord>;
      if (saved.schema === 2) {
        const secret = await this.credentials.get(this.account(saved.credential_ref));
        if (secret === null)
          throw new HogletError("authentication-required", "The saved Keychain credential is missing; run hoglet auth SERVER.");
        try { data = CredentialRecord.parse(JSON.parse(secret)); }
        catch { throw new HogletError("session-storage", "Keychain credential is invalid."); }
        if (data.service !== saved.service || data.user_id !== saved.user_id ||
            data.release !== saved.release || data.cookie_name !== saved.cookie_name)
          throw new HogletError("session-storage", "Keychain credential does not match its saved service profile.");
      } else data = saved;
      if (data.service !== this.config.service.href)
        throw new HogletError("session-storage", "Session belongs to a different service.");
      if ((data.release && data.release !== this.config.release) ||
          (data.cookie_name && data.cookie_name !== this.config.cookieName))
        throw new HogletError("session-storage", "Saved service profile changed; restart the MCP process.");
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
      this.credentialRef = saved.schema === 2 ? saved.credential_ref : undefined;
      if (previous !== await this.cookie(this.config.service)) this.generation++;
      if (saved.schema === 1 && this.config.credentialStore === "keychain") await this.save();
    } catch (e) {
      if (!found && (e as NodeJS.ErrnoException).code === "ENOENT") return;
      if (e instanceof HogletError) throw e;
      throw new HogletError("session-storage", "Session record is invalid or unreadable.");
    }
  }

  async checkStore(): Promise<void> {
    if (this.storedText === undefined) return; // Provisioning validates before first save.
    try {
      const { text, data } = await readSessionRecord(this.config.sessionFile);
      // Recheck Keychain presence even if its metadata did not change.
      if (text !== this.storedText || data.schema === 2) {
        const expectedUser = this.userId;
        await this.load();
        if (this.userId !== expectedUser)
          throw new HogletError("identity-changed", "Local provisioning changed the intended user; restart the MCP process.");
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        throw new HogletError("authentication-required", "Local session was removed; run hoglet auth before authenticated calls.");
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
      if (!this.userId) throw new HogletError("authentication-required", "Run hoglet auth or the local import-session command.");
      const directory = dirname(resolve(this.config.sessionFile));
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await assertPrivate(directory, true);
      let previous: Awaited<ReturnType<typeof readSessionRecord>> | undefined;
      try { previous = await readSessionRecord(this.config.sessionFile); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
      if (previous && previous.data.service !== this.config.service.href)
        throw new HogletError("session-storage", "Session belongs to a different service.");
      if (this.storedText !== undefined && previous?.text !== this.storedText)
        throw new HogletError("authentication-required", "Local session changed or was removed; reload it before saving.");
      const cookies = (await this.jar.getCookies(this.config.service.href)).map(c => ({
        key: c.key, value: c.value, path: c.path ?? "/", secure: c.secure, httpOnly: c.httpOnly,
        ...(c.expires instanceof Date ? { expires: c.expires.toISOString() } : {}),
      }));
      const data = {
        schema: 1, service: this.config.service.href, user_id: this.userId,
        release: this.config.release, cookie_name: this.config.cookieName, cookies,
      } as const;
      const secret = JSON.stringify(data) + "\n";
      const reference = this.config.credentialStore === "keychain" || this.credentialRef ? randomUUID() : undefined;
      let committed = false;
      const temporary = resolve(directory, ".session-" + randomUUID());
      try {
        if (reference) {
          await this.credentials.set(this.account(reference), secret);
          if (await this.credentials.get(this.account(reference)) !== secret)
            throw new HogletError("keychain-unavailable", "Keychain did not confirm the saved credential; the original session file was preserved.");
        }
        const text = reference ? JSON.stringify({
          schema: 2, service: data.service, user_id: data.user_id,
          release: data.release, cookie_name: data.cookie_name,
          credential_store: "macos-keychain", credential_ref: reference,
        }) + "\n" : secret;
        const file = await open(temporary, "wx", 0o600);
        try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
        await rename(temporary, this.config.sessionFile);
        committed = true; this.storedText = text; this.credentialRef = reference;
        if (previous?.data.schema === 2)
          await this.credentials.delete(this.account(previous.data.credential_ref));
      } finally {
        await unlink(temporary).catch(() => {});
        if (reference && !committed) await this.credentials.delete(this.account(reference));
      }
    });
    this.saveTail = job.catch(() => {});
    return job;
  }

  invalidate(): void { this.userId = undefined; this.jar = new CookieJar(); this.generation++; }
  async logout(): Promise<void> {
    this.invalidate(); await this.saveTail;
    try {
      const { data } = await readSessionRecord(this.config.sessionFile);
      if (data.service !== this.config.service.href)
        throw new HogletError("session-storage", "Session belongs to a different service.");
      if (data.schema === 2) await this.credentials.delete(this.account(data.credential_ref));
      await unlink(this.config.sessionFile);
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  }
}
