import { chromium, type BrowserContext } from "playwright";
import { Cookie } from "tough-cookie";
import { type Config, HogletError, delay, signalFor } from "./core.js";
import { ServiceHttp } from "./http.js";
import { Session } from "./session.js";

// Export only this service's configured credential, never storageState or GitHub cookies.
export async function importBrowserCredential(context: BrowserContext, session: Session): Promise<boolean> {
  const config = session.config;
  const cookies = (await context.cookies(config.service.href)).filter(c => c.name === config.cookieName &&
    c.domain.replace(/^\./, "") === config.service.hostname && config.service.pathname.startsWith(c.path));
  if (!cookies.length) return false;
  session.jar.removeAllCookiesSync();
  for (const c of cookies) await session.jar.setCookie(new Cookie({
    key: c.name, value: c.value, path: c.path, httpOnly: c.httpOnly, secure: c.secure,
    expires: c.expires > 0 ? new Date(c.expires * 1000) : "Infinity",
    hostOnly: true, domain: config.service.hostname,
  }), config.service.href);
  return true;
}

export async function browserLogin(config: Config, userId?: string, options: { headless?: boolean; signal?: AbortSignal } = {}): Promise<{ id: string; name: string }> {
  const browser = await chromium.launch({ headless: options.headless ?? false }).catch(() => {
    throw new HogletError("browser-unavailable", "Run hoglet install-browser (checkout: npx playwright install chromium), and run hoglet auth from a graphical desktop.");
  });
  const context = await browser.newContext();
  const session = new Session(config);
  const http = new ServiceHttp(config, session);
  const signal = signalFor(300000, options.signal);
  const abort = () => { void browser.close().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const page = await context.newPage();
    await page.goto(http.url("auth/github").href, { waitUntil: "domcontentloaded", timeout: 30000 });
    while (!signal.aborted) {
      if (await importBrowserCredential(context, session)) {
        let me: { id: string; name: string } | undefined;
        try {
          me = await http.discoverIdentity(signalFor(4000, signal));
        } catch {
          // Anonymous cookies and transient responses are expected during sign-in.
        }
        if (me) {
          if (userId !== undefined && me.id !== userId)
            throw new HogletError("identity-changed", "HedgeDoc identity differs from the requested user.");
          session.userId = me.id;
          await session.save();
          return me;
        }
      }
      if (page.isClosed()) throw new HogletError("login-cancelled", "Login browser was closed.");
      await delay(500, signal);
    }
    throw new HogletError("login-timeout", "Browser login did not finish within five minutes.");
  } finally {
    signal.removeEventListener("abort", abort);
    await context.close().catch(() => {}); await browser.close();
  }
}
