import { z } from "zod";
import { type Config, HogletError, interrupted, noteSelector, snapshot } from "./core.js";
import { Session } from "./session.js";

const Identity = z.object({ status: z.literal("ok"), id: z.string().min(1), name: z.string() });
export const NoteInfo = z.object({
  title: z.string(), description: z.string().nullable(), viewcount: z.number(),
  createtime: z.union([z.number(), z.string()]), updatetime: z.union([z.number(), z.string()]).nullable(),
});

export class ServiceHttp {
  onInvalidIdentity = () => {};
  constructor(public config: Config, public session: Session) {}

  url(path: string): URL {
    const url = new URL(path, this.config.service);
    if (url.origin !== this.config.service.origin || !url.pathname.startsWith(this.config.service.pathname))
      throw new HogletError("request-boundary", "Request destination escapes the configured service.");
    return url;
  }

  async get(path: string, kind: "json" | "markdown", signal: AbortSignal): Promise<string> {
    interrupted(signal);
    const url = this.url(path);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual", signal,
        headers: { cookie: await this.session.cookie(url), accept: kind === "json" ? "application/json" : "text/markdown" },
      });
    } catch { interrupted(signal); throw new HogletError("service-failure", "HedgeDoc request failed."); }
    await this.session.accept(response.headers, url);
    const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!response.ok || (kind === "json" ? type !== "application/json" : type !== "text/markdown")) {
      await response.body?.cancel();
      throw new HogletError(response.status >= 300 && response.status < 400 ? "unsupported-redirect" : "service-response",
        "HedgeDoc did not return the expected data response; redirects and login pages are not followed.");
    }
    const reader = response.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > this.config.maxBytes) throw new HogletError("content-limit", "Service response exceeds the content limit.");
        chunks.push(value);
      }
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
    } catch (e) {
      await reader.cancel().catch(() => {});
      if (e instanceof HogletError) throw e;
      interrupted(signal);
      throw new HogletError("service-response", "Response is invalid UTF-8 or its transfer failed.");
    } finally { reader.releaseLock(); }
  }

  async identity(signal: AbortSignal): Promise<{ id: string; name: string }> {
    try {
      const generation = this.session.generation;
      await this.session.checkStore();
      if (generation !== this.session.generation) this.onInvalidIdentity();
      if (!this.session.userId)
        throw new HogletError("authentication-required", "Run the local login or import-session command.");
      const me = Identity.parse(JSON.parse(await this.get("me", "json", signal)));
      if (me.id !== this.session.userId)
        throw new HogletError("identity-changed", "HedgeDoc identity differs from the provisioned user.");
      return { id: me.id, name: me.name };
    } catch (e) {
      this.session.invalidate(); this.onInvalidIdentity();
      if (e instanceof HogletError) throw e;
      throw new HogletError("authentication-required", "HedgeDoc did not verify the provisioned user; run local login.");
    }
  }

  async read(note: string, signal: AbortSignal, validate = true) {
    noteSelector(note);
    if (validate && !this.config.anonymous) await this.identity(signal);
    const markdown = await this.get(encodeURIComponent(note) + "/download", "markdown", signal);
    return { note, service: this.config.service.href, markdown, snapshot: snapshot(this.config, note, markdown), source: "persisted" as const };
  }

  async info(note: string, signal: AbortSignal) {
    noteSelector(note);
    if (!this.config.anonymous) await this.identity(signal);
    try { return { note, ...NoteInfo.parse(JSON.parse(await this.get(encodeURIComponent(note) + "/info", "json", signal))) }; }
    catch (e) { if (e instanceof HogletError) throw e; throw new HogletError("service-response", "Invalid note metadata."); }
  }
}
