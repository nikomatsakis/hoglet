import { type Config, HogletError, delay, interrupted, noteSelector, safeError, signalFor, snapshot } from "./core.js";
import { compileEdits, type Replacement } from "./edits.js";
import { ServiceHttp } from "./http.js";
import { LiveNote } from "./realtime.js";
import { Session } from "./session.js";

export interface EditResult {
  outcome: "unchanged" | "stale-snapshot" | "rejected" | "accepted" | "persisted-observed" | "uncertain";
  submitted: boolean;
  acceptance: "not-submitted" | "unknown" | "acknowledged";
  persistence: "not-observed" | "observed";
  concurrency_observed: boolean;
  note: string;
  source?: "live";
  markdown?: string;
  snapshot?: string;
  persisted_snapshot?: string;
  error?: { code: string; message: string };
}

export class Bridge {
  http: ServiceHttp;
  private queue = Promise.resolve();
  private sockets = new Set<LiveNote>();
  private shutdown = new AbortController();
  private jobs = new Set<Promise<unknown>>();
  constructor(public config: Config, public session: Session) {
    this.http = new ServiceHttp(config, session);
    this.http.onInvalidIdentity = () => { for (const live of this.sockets) live.close(); };
  }

  run<T>(work: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> {
    const signal = signalFor(this.config.callMs, AbortSignal.any([this.shutdown.signal, ...(parent ? [parent] : [])]));
    const job = Promise.resolve().then(() => { interrupted(signal); return work(signal); });
    this.jobs.add(job);
    void job.finally(() => this.jobs.delete(job)).catch(() => {});
    return job;
  }

  read(note: string, signal?: AbortSignal) { return this.run(s => this.http.read(note, s), signal); }
  info(note: string, signal?: AbortSignal) { return this.run(s => this.http.info(note, s), signal); }

  edit(note: string, expected: string, edits: Replacement[], signal?: AbortSignal): Promise<EditResult> {
    return this.run<EditResult>(async s => {
      noteSelector(note);
      // A service-wide queue also covers different aliases for the same document.
      const previous = this.queue;
      let release!: () => void;
      this.queue = new Promise<void>(resolve => { release = resolve; });
      let abort!: () => void;
      const cancelled = new Promise<never>((_, reject) => {
        abort = () => reject(new HogletError("observation-ended", "Deadline or cancellation ended queue waiting."));
        s.addEventListener("abort", abort, { once: true });
        if (s.aborted) abort();
      });
      try {
        await Promise.race([previous, cancelled]);
        return await this.editNow(note, expected, edits, s);
      } catch (e) {
        return {
          outcome: "rejected", submitted: false, acceptance: "not-submitted",
          persistence: "not-observed", concurrency_observed: false, note, error: safeError(e),
        };
      } finally {
        s.removeEventListener("abort", abort);
        // A canceled waiter must not release its successors before the prior job finishes.
        void previous.finally(release);
      }
    }, signal).catch((e): EditResult => ({
      outcome: "rejected", submitted: false, acceptance: "not-submitted",
      persistence: "not-observed", concurrency_observed: false, note, error: safeError(e),
    }));
  }

  private async editNow(note: string, expected: string, edits: Replacement[], signal: AbortSignal): Promise<EditResult> {
    const result: EditResult = {
      outcome: "rejected", submitted: false, acceptance: "not-submitted",
      persistence: "not-observed", concurrency_observed: false, note,
    };
    let live: LiveNote | undefined;
    try {
      const identity = await this.http.identity(signal);
      const generation = this.session.generation;
      live = new LiveNote(this.config, note, await this.session.cookie(this.http.url("socket.io/")));
      this.sockets.add(live);
      await live.connect(signalFor(this.config.connectMs, signal));
      live.mayEdit(identity.id);
      const base = live.text;
      const current = snapshot(this.config, note, base);
      Object.assign(result, { markdown: base, snapshot: current, source: "live" });
      if (expected !== current) return { ...result, outcome: "stale-snapshot" };
      const op = compileEdits(base, edits, this.config.maxBytes);
      // Validate identity again after connection setup. Any event during this await
      // can invalidate the checked base; the final guard and emit are synchronous.
      await this.http.identity(signal);
      interrupted(signal);
      live.mayEdit(identity.id);
      if (generation !== this.session.generation)
        throw new HogletError("session-changed", "Credential changed during preflight; read again before editing.");
      if (live.text !== base) return { ...result, outcome: "stale-snapshot", markdown: live.text, snapshot: snapshot(this.config, note, live.text), concurrency_observed: true };
      if (op.isNoop()) return { ...result, outcome: "unchanged" };
      live.submit(op);
      await live.wait(() => live!.accepted, signalFor(this.config.ackMs, signal));
      result.outcome = "accepted";
      // Revalidation and readback failures must preserve a known acknowledgement.
      await this.http.identity(signal);
      const persistSignal = signalFor(this.config.persistMs, signal);
      while (!persistSignal.aborted && !live.failure) {
        const observed = live.text;
        const persisted = await this.http.read(note, persistSignal, false);
        if (live.text === observed && persisted.markdown === observed.replaceAll("\0", "")) {
          result.outcome = "persisted-observed"; result.persistence = "observed";
          result.persisted_snapshot = persisted.snapshot; break;
        }
        await delay(100, persistSignal);
      }
    } catch (e) { result.error = safeError(e); }
    finally {
      if (live) {
        result.submitted = live.submitted;
        result.acceptance = live.accepted ? "acknowledged" : live.submitted ? "unknown" : "not-submitted";
        result.concurrency_observed = live.concurrency;
        if (live.submitted) {
          if (!live.accepted) result.outcome = "uncertain";
          else if (result.persistence !== "observed") result.outcome = "accepted";
          // Pending local application without ack is speculative, never reported as observed.
          if (live.accepted) Object.assign(result, {
            markdown: live.text, snapshot: snapshot(this.config, note, live.text), source: "live",
          });
          else { delete result.markdown; delete result.snapshot; delete result.source; }
        }
        live.close(); this.sockets.delete(live);
      }
    }
    return result;
  }

  async close(): Promise<void> {
    this.shutdown.abort();
    for (const live of this.sockets) live.close();
    await Promise.allSettled([...this.jobs]);
  }
}
