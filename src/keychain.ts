import { HogletError } from "./core.js";

export interface Credentials {
  get(account: string): Promise<string | null>;
  set(account: string, value: string): Promise<void>;
  delete(account: string): Promise<void>;
}

// Native calls keep credentials out of process arguments and captured diagnostics.
export class MacKeychain implements Credentials {
  private async entry(account: string) {
    if (process.platform !== "darwin")
      throw new HogletError("keychain-unavailable", "This session requires macOS Keychain.");
    try {
      const { AsyncEntry } = await import("@napi-rs/keyring");
      return new AsyncEntry("Hoglet", account);
    } catch {
      throw new HogletError("keychain-unavailable", "The macOS Keychain adapter could not load; run npm ci.");
    }
  }

  private async access<T>(account: string, action: (entry: Awaited<ReturnType<MacKeychain["entry"]>>) => Promise<T>): Promise<T> {
    const entry = await this.entry(account);
    try { return await action(entry); }
    catch {
      throw new HogletError("keychain-unavailable", "macOS Keychain access failed. Unlock your login Keychain and allow Hoglet's Node process access, then retry.");
    }
  }

  get(account: string) {
    return this.access(account, entry => entry.getPassword(AbortSignal.timeout(10000)));
  }
  set(account: string, value: string) {
    return this.access(account, entry => entry.setPassword(value, AbortSignal.timeout(10000)));
  }
  async delete(account: string) {
    await this.access(account, async entry => {
      await entry.deleteCredential(AbortSignal.timeout(10000));
      if (await entry.getPassword(AbortSignal.timeout(10000)) !== null)
        throw new Error("Credential deletion was not confirmed.");
    });
  }
}
