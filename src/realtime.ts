import io2 from "socket.io-client-v2";
import { io, type Socket } from "socket.io-client";
import { type Config, HogletError, interrupted } from "./core.js";
import { decodeOperation, TextOperation, type Operation } from "./edits.js";

export class LiveNote {
  socket: Socket;
  text = "";
  revision = 0;
  refresh?: { permission: string; owner: string | null; docmaxlength: number };
  pending?: Operation;
  submitted = false;
  accepted = false;
  concurrency = false;
  failure?: HogletError;
  private gotDoc = false;
  private gotVersion = false;
  private listeners = new Set<() => void>();
  constructor(public config: Config, note: string, cookie: string) {
    const options = {
      path: config.service.pathname + "socket.io/",
      query: { noteId: note }, extraHeaders: { Cookie: cookie },
      transports: ["websocket"], autoConnect: false, reconnection: false,
      // Node 24 supplies a global WebSocket. Legacy Engine.IO otherwise selects
      // its browser adapter, which silently drops the authentication headers.
      forceNode: true,
      forceNew: true, timeout: config.connectMs,
      transportOptions: { websocket: { maxPayload: config.maxBytes * 4 } },
    };
    this.socket = config.release === "1.10.3" ? io2(config.service.origin, options) : io(config.service.origin, options);
    const fail = (message: string) => {
      this.failure ??= new HogletError("protocol-failure", message);
      this.changed();
    };
    this.socket.on("connect", () => this.socket.emit("version"));
    this.socket.on("version", value => {
      if (!value || typeof value.version !== "string" ||
          !(value.version === config.release || value.version.startsWith(config.release + "-")))
        return fail("Service release does not match the configured prototype profile.");
      this.gotVersion = true; this.changed();
    });
    this.socket.on("doc", value => {
      if (this.gotDoc) return fail("The document generation changed; no operation will be replayed.");
      if (!value || typeof value.str !== "string" || !value.str.isWellFormed() ||
          Buffer.byteLength(value.str) > config.maxBytes ||
          !Number.isSafeInteger(value.revision) || value.revision < 0)
        return fail("Malformed initial document.");
      this.text = value.str; this.revision = value.revision; this.gotDoc = true; this.changed();
    });
    this.socket.on("refresh", value => {
      if (!value || typeof value.permission !== "string" ||
          !(typeof value.owner === "string" || value.owner === null) ||
          !Number.isSafeInteger(value.docmaxlength) || value.docmaxlength < 0)
        return fail("Malformed permission metadata.");
      this.refresh = { permission: value.permission, owner: value.owner, docmaxlength: value.docmaxlength };
      this.changed();
    });
    this.socket.on("operation", (_clientId, revision, value) => {
      try {
        if (!this.gotDoc || revision !== this.revision + 1)
          throw new Error("Unexpected revision.");
        const remote = decodeOperation(value, this.text, config.maxBytes);
        if (this.pending) {
          // Match HedgeDoc's AwaitingConfirm tie breaking: local operation first.
          // @types/ot 0.0.8 incorrectly types transform's pair as one operation.
          const [localPrime] = TextOperation.transform(this.pending, remote) as unknown as [Operation, Operation];
          this.pending = localPrime;
        }
        this.text = remote.apply(this.text);
        this.revision = revision; this.concurrency = true;
        if (!this.observedText().isWellFormed()) throw new Error("Invalid reconciled Unicode.");
        this.changed();
      } catch { fail("Remote operation cannot be reconciled with this document generation."); }
    });
    this.socket.on("ack", revision => {
      if (!this.pending || this.accepted || revision !== this.revision + 1)
        return fail("Malformed or unexpected named acknowledgement.");
      try {
        this.text = this.pending.apply(this.text); this.pending = undefined;
        this.revision = revision; this.accepted = true; this.changed();
      } catch { fail("Acknowledged operation could not be reconciled."); }
    });
    this.socket.on("disconnect", () => fail("Editing connection ended; no operation will be replayed."));
    this.socket.on("connect_error", () => fail("The configured realtime transport could not connect."));
    this.socket.on("error", () => fail("Realtime transport failed."));
  }

  private changed(): void { for (const notify of this.listeners) notify(); }
  observedText(): string { return this.pending ? this.pending.apply(this.text) : this.text; }

  async wait(predicate: () => boolean, signal: AbortSignal): Promise<void> {
    interrupted(signal);
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { this.listeners.delete(check); signal.removeEventListener("abort", abort); };
      const abort = () => { cleanup(); reject(new HogletError("observation-ended", "Deadline or cancellation ended observation.")); };
      const check = () => {
        if (this.failure) { cleanup(); reject(this.failure); }
        else if (predicate()) { cleanup(); resolve(); }
      };
      this.listeners.add(check); signal.addEventListener("abort", abort, { once: true }); check();
    });
  }

  async connect(signal: AbortSignal): Promise<void> {
    const ready = this.wait(() => this.gotDoc && this.gotVersion && !!this.refresh, signal);
    this.socket.connect();
    await ready;
  }

  mayEdit(userId: string): void {
    const { permission, owner } = this.refresh!;
    if (!["freely", "editable", "limited", "locked", "protected", "private"].includes(permission))
      throw new HogletError("unsupported-permission", "Unknown note permission mode.");
    if (["locked", "protected", "private"].includes(permission) && owner !== userId)
      throw new HogletError("permission-denied", "The intended user is not the owner of this owner-editable note.");
  }

  submit(op: Operation): void {
    if (this.failure || !this.socket.connected || this.pending || this.submitted)
      throw new HogletError("protocol-failure", "Editing connection is not ready for one submission.");
    if (op.baseLength !== this.text.length || op.targetLength > this.refresh!.docmaxlength)
      throw new HogletError("content-limit", "Operation violates the live document length limit.");
    this.pending = op;
    // Mark possible submission before entering the transport; never retry this event.
    this.submitted = true;
    this.socket.emit("operation", this.revision, op.toJSON(), null);
  }

  close(): void {
    this.failure ??= new HogletError("observation-ended", "Local editing connection closed.");
    this.changed(); this.socket.disconnect(); this.socket.removeAllListeners();
  }
}
