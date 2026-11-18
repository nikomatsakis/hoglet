import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server } from "socket.io";
import io2 from "socket.io-v2";
import { TextOperation, type Operation } from "../src/edits.js";
import { type Config, serviceUrl } from "../src/core.js";

export const SECRET = "SYNTHETIC-HOGLET-SESSION-7e4c";

// Applies the wire representation independently of the production OT library.
export function applyWire(base: string, wire: (number | string)[]): string {
  let cursor = 0, text = "";
  for (const x of wire) {
    if (typeof x === "string") text += x;
    else if (x > 0) { text += base.slice(cursor, cursor + x); cursor += x; }
    else cursor -= x;
  }
  if (cursor !== base.length) throw new Error("Fixture operation did not consume the base.");
  return text;
}

export class Fixture {
  server = createServer((req, res) => { void this.handle(req, res); });
  io: any;
  base = "Hello 😀 world\r\n";
  stored = this.base;
  ops: Operation[] = [];
  operations = 0;
  permission = "editable";
  owner = "user-1";
  identity = "user-1";
  mode: "normal" | "silent" | "drop" | "callback" | "no-save" | "concurrent" | "reset" | "late" = "normal";
  httpMode: "normal" | "html" | "redirect" | "invalid-utf8" | "large" | "stall" | "stall-persistence" = "normal";
  stallConnect = false;
  requests: { path: string; cookie: string }[] = [];
  sockets = new Set<any>();
  versionOverride?: string;
  meCalls = 0;
  identityLossAfterWrite = false;
  renewal = false;
  nextCookie = SECRET;
  remoteBeforeSubmit?: (number | string)[];
  remoteBeforeSubmitDone = false;
  timers = new Set<NodeJS.Timeout>();
  config!: Config;

  constructor(public release: Config["release"], public prefix = "/pad/") {
    this.io = release === "1.10.3" ? io2(this.server, { path: prefix + "socket.io/" })
      : new Server(this.server, { path: prefix + "socket.io/" });
    this.io.on("connection", (socket: any) => {
      this.requests.push({ path: socket.request.url, cookie: socket.request.headers.cookie ?? "" });
      this.sockets.add(socket);
      socket.on("disconnect", () => this.sockets.delete(socket));
      socket.on("version", () => socket.emit("version", { version: this.versionOverride ?? release }));
      if (this.stallConnect) return;
      socket.emit("doc", { str: this.base, revision: this.ops.length, clients: {} });
      socket.emit("refresh", { permission: this.permission, owner: this.owner, docmaxlength: 1000000 });
      socket.on("operation", (revision: number, wire: (number | string)[], _selection: null, callback?: () => void) => {
        this.operations++;
        if (this.mode === "silent") return;
        if (this.mode === "callback") {
          // A protocol-level Socket.IO ACK is not HedgeDoc's named "ack".
          // Hoglet deliberately registers no operation callback to correlate it.
          socket.packet({ type: 3, id: 0, data: [this.ops.length + 1] });
          callback?.(); return;
        }
        if (this.mode === "reset") { socket.emit("doc", { str: this.base, revision: 0, force: true }); return; }
        if (this.mode === "concurrent") this.remote(socket, [6, "new ", this.base.length - 6]);
        let op = TextOperation.fromJSON(wire);
        for (const remote of this.ops.slice(revision))
          [op] = TextOperation.transform(op, remote) as unknown as [Operation, Operation];
        this.base = applyWire(this.base, op.toJSON()); this.ops.push(op);
        if (this.mode !== "no-save") this.stored = this.base.replaceAll("\0", "");
        if (this.identityLossAfterWrite) this.identity = "";
        if (this.mode === "drop") { socket.disconnect(true); return; }
        if (this.mode === "late") {
          const timer = setTimeout(() => { this.timers.delete(timer); socket.emit("ack", this.ops.length); }, 300);
          this.timers.add(timer);
        } else socket.emit("ack", this.ops.length);
      });
    });
  }

  remote(socket: any, wire: (number | string)[]) {
    const op = TextOperation.fromJSON(wire);
    this.base = applyWire(this.base, wire); this.ops.push(op); this.stored = this.base;
    socket.emit("operation", "second-editor", this.ops.length, wire, null);
  }

  async handle(req: IncomingMessage, res: ServerResponse) {
    const path = req.url!;
    this.requests.push({ path, cookie: req.headers.cookie ?? "" });
    if (!path.startsWith(this.prefix)) { res.writeHead(404); res.end(); return; }
    if (path === this.prefix + "auth/github") {
      res.setHeader("set-cookie", `${this.config.cookieName}=${SECRET}; Path=/; HttpOnly`);
      res.setHeader("content-type", "text/html");
      res.end("<p>Synthetic service login completed.</p>"); return;
    }
    if (path === this.prefix + "me") {
      this.meCalls++;
      res.setHeader("content-type", "application/json");
      if (this.renewal) {
        res.setHeader("set-cookie", `${this.config.cookieName}=${this.nextCookie}; Path=/; HttpOnly; Max-Age=3600`);
      }
      const body = JSON.stringify(req.headers.cookie?.includes(this.nextCookie) && this.identity
        ? { status: "ok", id: this.identity, name: "Synthetic user", photo: null } : { status: "forbidden" });
      if (this.remoteBeforeSubmit && !this.remoteBeforeSubmitDone && this.sockets.size) {
        this.remoteBeforeSubmitDone = true;
        for (const socket of this.sockets) this.remote(socket, this.remoteBeforeSubmit);
        const timer = setTimeout(() => { this.timers.delete(timer); res.end(body); }, 30);
        this.timers.add(timer); return;
      }
      res.end(body);
      return;
    }
    if (this.httpMode === "stall" || this.httpMode === "stall-persistence" && this.operations) return;
    if (this.httpMode === "redirect") {
      res.writeHead(302, { location: "http://127.0.0.1:9/credential-sink" }); res.end(); return;
    }
    if (this.httpMode === "html") {
      res.writeHead(200, { "content-type": "text/html" }); res.end("<p>Log in</p>"); return;
    }
    if (path.endsWith("/info")) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ title: "Test", description: null, viewcount: 1, createtime: 1, updatetime: null })); return;
    }
    if (!path.endsWith("/download") || path.includes("missing/")) { res.writeHead(404); res.end(); return; }
    res.setHeader("content-type", "text/markdown; charset=utf-8");
    res.end(this.httpMode === "invalid-utf8" ? Buffer.from([0xff])
      : this.httpMode === "large" ? "x".repeat(2000000) : this.stored);
  }

  async start(sessionFile: string) {
    await new Promise<void>(resolve => this.server.listen(0, "127.0.0.1", resolve));
    const address = this.server.address() as { port: number };
    this.config = {
      service: serviceUrl(`http://127.0.0.1:${address.port}${this.prefix}`),
      release: this.release, sessionFile, credentialStore: "file", anonymous: false, cookieName: "connect.sid",
      callMs: 1800, connectMs: 600, ackMs: 250, persistMs: 250, shutdownMs: 2000, maxBytes: 1048576,
    };
    return this.config;
  }

  async close() {
    for (const timer of this.timers) clearTimeout(timer);
    this.io.close();
    this.server.closeAllConnections();
    await new Promise<void>(resolve => this.server.close(() => resolve()));
  }
}
