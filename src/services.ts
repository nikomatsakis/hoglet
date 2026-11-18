import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join } from "node:path";
import { Bridge } from "./bridge.js";
import { type Config, configFromEnv, dataDirectory, HogletError, serviceArgument } from "./core.js";
import { Session, readSessionRecord } from "./session.js";

export class Services {
  readonly defaultService?: string;
  readonly shutdownMs: number;
  readonly callMs: number;
  readonly maxBytes: number;
  private bridges = new Map<string, Promise<Bridge>>();
  private closing = false;

  constructor(private env = process.env, serviceInput?: string) {
    this.env = { ...env };
    this.defaultService = serviceInput !== undefined ? serviceArgument(serviceInput).href
      : env.HOGLET_SERVICE ? configFromEnv(env).service.href : undefined;
    const limits = configFromEnv({ ...env, HOGLET_SERVICE: this.defaultService ?? "https://config.invalid/" });
    this.shutdownMs = limits.shutdownMs;
    this.callMs = limits.callMs;
    this.maxBytes = limits.maxBytes;
    if (env.HOGLET_SESSION_FILE && !this.defaultService)
      throw new HogletError("configuration", "A custom session file requires a default service.");
  }

  private base(service: string): Config {
    return configFromEnv({
      ...this.env, HOGLET_SERVICE: service,
      HOGLET_SESSION_FILE: service === this.defaultService ? this.env.HOGLET_SESSION_FILE : undefined,
    });
  }

  private async saved(config: Config): Promise<Config | undefined> {
    try {
      const { data } = await readSessionRecord(config.sessionFile);
      if (data.service !== config.service.href)
        throw new HogletError("session-storage", "Session belongs to a different service.");
      return configFromEnv({
        ...this.env, HOGLET_SERVICE: data.service, HOGLET_SESSION_FILE: config.sessionFile,
        HOGLET_RELEASE: data.release ?? this.env.HOGLET_RELEASE,
        HOGLET_COOKIE_NAME: data.cookie_name ?? this.env.HOGLET_COOKIE_NAME,
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw e;
    }
  }

  async list() {
    if (this.closing) throw new HogletError("shutting-down", "Hoglet is shutting down.");
    const configs = new Map<string, Config>();
    const root = dataDirectory(this.env);
    let entries: Dirent[];
    try { entries = await readdir(root, { withFileTypes: true }); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      entries = [];
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^[a-f0-9]{20}$/.test(entry.name)) continue;
      const path = join(root, entry.name, "session.json");
      try {
        const { data } = await readSessionRecord(path);
        const base = this.base(data.service);
        // The record must live under its canonical service fingerprint.
        const expected = configFromEnv({ ...this.env, HOGLET_SERVICE: data.service, HOGLET_SESSION_FILE: undefined });
        if (expected.sessionFile !== path || expected.service.href !== data.service)
          throw new HogletError("session-storage", "Session record has an invalid service scope.");
        const config = await this.saved(base);
        if (config) configs.set(config.service.href, config);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
    if (this.defaultService) {
      const config = await this.saved(this.base(this.defaultService));
      if (config) configs.set(config.service.href, config);
    }
    const services = [];
    for (const config of configs.values()) {
      const { data } = await readSessionRecord(config.sessionFile);
      services.push({ service: config.service.href, user_id: data.user_id, release: config.release });
    }
    return services.sort((a, b) => a.service.localeCompare(b.service));
  }

  async bridge(serviceInput?: string): Promise<Bridge> {
    if (this.closing) throw new HogletError("shutting-down", "Hoglet is shutting down.");
    let service = serviceInput !== undefined ? serviceArgument(serviceInput).href : this.defaultService;
    if (!service) {
      const saved = await this.list();
      if (saved.length !== 1)
        throw new HogletError(saved.length ? "service-required" : "authentication-required",
          saved.length ? "Select a service from list_services." : "Run hoglet auth SERVER to save a service session.");
      service = saved[0].service;
    }
    let pending = this.bridges.get(service);
    if (!pending) {
      const selected = service;
      pending = this.load(selected);
      this.bridges.set(selected, pending);
      void pending.catch(() => {
        if (this.bridges.get(selected) === pending) this.bridges.delete(selected);
      });
    }
    return pending;
  }

  private async load(service: string): Promise<Bridge> {
    const base = this.base(service);
    const saved = await this.saved(base);
    if (!saved && !(base.anonymous && service === this.defaultService))
      throw new HogletError("authentication-required", "This service has no saved session; run hoglet auth SERVER.");
    const config = saved ?? base;
    const session = new Session(config);
    if (!config.anonymous) await session.load();
    const bridge = new Bridge(config, session);
    if (this.closing) {
      await bridge.close();
      throw new HogletError("shutting-down", "Hoglet is shutting down.");
    }
    return bridge;
  }

  async close(): Promise<void> {
    this.closing = true;
    await Promise.allSettled([...this.bridges.values()].map(async pending => (await pending).close()));
  }
}
