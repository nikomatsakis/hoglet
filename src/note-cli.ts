import { createReadStream } from "node:fs";
import { HogletError, interrupted, safeError, signalFor } from "./core.js";
import { executeOperation, operationInputs, type OperationName } from "./operations.js";
import { Services } from "./services.js";

const names: Record<string, OperationName> = {
  services: "list_services", read: "read_note", info: "get_note_info", edit: "edit_note",
};

function argumentsFor(command: string, args: string[]) {
  const options = new Map<string, string>();
  const positional: string[] = [];
  let json = false, flags = true;
  const allowed = command === "edit" ? ["--service", "--snapshot", "--edits"]
    : command === "services" ? [] : ["--service"];
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (flags && key === "--") { flags = false; continue; }
    if (flags && key === "--json") {
      if (json) throw new HogletError("usage", "Supply --json only once.");
      json = true;
    } else if (flags && key.startsWith("--")) {
      const value = args[++i];
      if (!allowed.includes(key) || options.has(key) || !value || value.startsWith("--"))
        throw new HogletError("usage", "Invalid or incomplete arguments; run hoglet help.");
      options.set(key, value);
    } else positional.push(key);
  }
  if (positional.length !== (command === "services" ? 0 : 1))
    throw new HogletError("usage", command === "services" ? "Run hoglet services without a note."
      : "Supply one note identifier; select its server with --service SERVER.");
  if (command === "edit" && (!options.has("--snapshot") || !options.has("--edits")))
    throw new HogletError("usage", "Editing requires --snapshot TOKEN and --edits FILE (or - for stdin).");
  return { options, note: positional[0], json };
}

async function readEdits(path: string, maxBytes: number, signal: AbortSignal): Promise<unknown> {
  interrupted(signal);
  if (path === "-" && process.stdin.isTTY)
    throw new HogletError("usage", "Pipe a JSON replacement array to --edits -, or use a file.");
  const input = path === "-" ? process.stdin : createReadStream(path, { signal });
  const abort = () => input.destroy(new HogletError("observation-ended", "Edit input deadline or cancellation ended observation."));
  signal.addEventListener("abort", abort, { once: true });
  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    for await (const chunk of input) {
      interrupted(signal);
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > maxBytes * 6 + 32768)
        throw new HogletError("content-limit", "Edit JSON exceeds the input limit.");
      chunks.push(buffer);
    }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new HogletError("invalid-edit", "Edits must be a valid UTF-8 JSON replacement array."); }
  } catch (error) {
    interrupted(signal);
    if (error instanceof HogletError) throw error;
    throw new HogletError("invalid-edit", "Could not read the edits JSON input.");
  } finally {
    signal.removeEventListener("abort", abort);
    input.destroy();
  }
}

export async function runNoteCommand(command: string, args: string[]): Promise<void> {
  const { options, note, json } = argumentsFor(command, args);
  const services = new Services(process.env, options.get("--service"));
  const cancel = new AbortController();
  let exitSignal = 0, force: NodeJS.Timeout | undefined;
  const stop = (code: number) => {
    if (exitSignal) return;
    exitSignal = code;
    cancel.abort();
    force = setTimeout(() => {
      console.error(JSON.stringify({ error: {
        code: "shutdown-observation-ended",
        message: "Shutdown grace ended; submitted writes may remain unconfirmed.",
      } }));
      process.exit(code);
    }, services.shutdownMs);
    force.unref();
  };
  const interrupt = () => stop(130), terminate = () => stop(143);
  process.once("SIGINT", interrupt); process.once("SIGTERM", terminate);
  try {
    const name = names[command];
    const input: Record<string, unknown> = command === "services" ? {} : { note, service: options.get("--service") };
    if (command === "edit") {
      input.expected_snapshot = options.get("--snapshot");
      if (!/^sha256:[0-9a-f]{64}$/.test(input.expected_snapshot as string))
        throw new HogletError("invalid-arguments", "Use the snapshot token returned by hoglet read --json.");
      input.edits = await readEdits(options.get("--edits")!, services.maxBytes, signalFor(services.callMs, cancel.signal));
    }
    if (!operationInputs[name].safeParse(input).success)
      throw new HogletError("invalid-arguments", "Arguments do not match the operation contract.");
    const { data, isError } = await executeOperation(services, name, input, cancel.signal);
    if (data.outcome) {
      console.log(JSON.stringify(data));
      process.exitCode = data.outcome === "accepted" || data.outcome === "uncertain" ? 2 : isError ? 1 : 0;
    } else if (isError) {
      console.error(JSON.stringify(data)); process.exitCode = 1;
    } else if (command === "read" && !json) {
      process.stdout.write(data.markdown as string);
    } else console.log(JSON.stringify(data));
  } catch (error) {
    console.error(JSON.stringify({ error: safeError(error) })); process.exitCode = 1;
  } finally {
    await services.close();
    if (force) clearTimeout(force);
    process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", terminate);
    if (exitSignal) process.exitCode = exitSignal;
  }
}
