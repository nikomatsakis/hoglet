import { z } from "zod";
import { HogletError, interrupted, safeError } from "./core.js";
import { Services } from "./services.js";

const note = z.string().min(1).max(200).describe("One identifier or alias within the configured service; URLs and paths are unsupported.");
const service = z.string().min(1).max(2048).optional()
  .describe("Saved HedgeDoc service hostname or HTTP(S) base URL. Use list_services to discover choices. Required if multiple services are saved and no default is configured.");
export const operationInputs = {
  list_services: z.object({}).strict(),
  read_note: z.object({ note, service }).strict(),
  get_note_info: z.object({ note, service }).strict(),
  edit_note: z.object({
    note, service, expected_snapshot: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    edits: z.array(z.object({
      old_text: z.string().max(10485760), new_text: z.string().max(10485760),
    }).strict()).min(1).max(128),
  }).strict(),
};
export type OperationName = keyof typeof operationInputs;
export interface OperationResult { data: Record<string, unknown>; isError: boolean }

// The CLI and MCP adapters share validation, selection and write classification.
export async function executeOperation(services: Services, name: OperationName, input: unknown,
  signal?: AbortSignal): Promise<OperationResult> {
  try {
    if (signal) interrupted(signal);
    const parsed = operationInputs[name].safeParse(input);
    if (!parsed.success) throw new HogletError("invalid-arguments", "Arguments do not match the operation contract.");
    if (name === "list_services")
      return { data: { services: await services.list() }, isError: false };
    const args = parsed.data as z.infer<typeof operationInputs.edit_note>;
    const bridge = await services.bridge(args.service);
    if (signal) interrupted(signal);
    if (name === "read_note")
      return { data: await bridge.read(args.note, signal), isError: false };
    if (name === "get_note_info")
      return { data: { ...await bridge.info(args.note, signal), service: bridge.config.service.href }, isError: false };
    const data = await bridge.edit(args.note, args.expected_snapshot, args.edits, signal);
    return {
      data: { ...data, service: bridge.config.service.href },
      isError: !["unchanged", "persisted-observed"].includes(data.outcome),
    };
  } catch (error) { return { data: { error: safeError(error) }, isError: true }; }
}
