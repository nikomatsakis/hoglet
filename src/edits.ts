import ot from "ot";
import { HogletError } from "./core.js";

export const TextOperation = ot.TextOperation;
export type Operation = InstanceType<typeof TextOperation>;
export interface Replacement { old_text: string; new_text: string }

// A-notes-precise-edits:replacement-validation,unicode-operations
export function compileEdits(base: string, edits: Replacement[], maxBytes: number): Operation {
  if (!base.isWellFormed() || !Array.isArray(edits) || edits.length < 1 || edits.length > 128)
    throw new HogletError("invalid-edit", "Use 1–128 replacements over valid Unicode.");
  let inputBytes = 0;
  const ranges = edits.map(edit => {
    if (typeof edit.old_text !== "string" || typeof edit.new_text !== "string" ||
        !edit.old_text.isWellFormed() || !edit.new_text.isWellFormed() ||
        edit.old_text.includes("\0") || edit.new_text.includes("\0"))
      throw new HogletError("invalid-edit", "Replacement text must be valid Unicode without NUL.");
    inputBytes += Buffer.byteLength(edit.old_text) + Buffer.byteLength(edit.new_text);
    if (inputBytes > maxBytes) throw new HogletError("content-limit", "Replacement input exceeds the content limit.");
    const start = base.indexOf(edit.old_text);
    if (!edit.old_text.length) {
      if (base.length || edits.length !== 1)
        throw new HogletError("invalid-edit", "Empty old_text is only valid for one insertion into an empty document.");
    } else if (start === -1 || base.indexOf(edit.old_text, start + 1) !== -1) {
      throw new HogletError("invalid-edit", "Each old_text must occur exactly once in the checked base.");
    }
    return { start, end: start + edit.old_text.length, ...edit };
  }).sort((a, b) => a.start - b.start);
  let cursor = 0;
  const op = new TextOperation();
  for (const r of ranges) {
    if (r.start < cursor) throw new HogletError("invalid-edit", "Replacement ranges overlap.");
    op.retain(r.start - cursor);
    let prefix = 0, suffix = 0;
    while (prefix < Math.min(r.old_text.length, r.new_text.length) &&
      r.old_text[prefix] === r.new_text[prefix]) prefix++;
    const boundary = (text: string, index: number) =>
      !(index > 0 && index < text.length && /[\uD800-\uDBFF]/.test(text[index - 1]) && /[\uDC00-\uDFFF]/.test(text[index]));
    while (!boundary(r.old_text, prefix) || !boundary(r.new_text, prefix)) prefix--;
    while (suffix < Math.min(r.old_text.length, r.new_text.length) - prefix &&
      r.old_text[r.old_text.length - suffix - 1] === r.new_text[r.new_text.length - suffix - 1]) suffix++;
    while (!boundary(r.old_text, r.old_text.length - suffix) || !boundary(r.new_text, r.new_text.length - suffix)) suffix--;
    op.retain(prefix).insert(r.new_text.slice(prefix, r.new_text.length - suffix))
      .delete(r.old_text.length - prefix - suffix).retain(suffix);
    cursor = r.end;
  }
  op.retain(base.length - cursor);
  const result = op.apply(base);
  if (Buffer.byteLength(result) > maxBytes)
    throw new HogletError("content-limit", "Resulting document exceeds the content limit.");
  return op;
}

export function decodeOperation(value: unknown, base: string, maxBytes: number): Operation {
  if (!Array.isArray(value) || value.length > maxBytes ||
      value.some(x => typeof x === "number" ? !Number.isSafeInteger(x) || x === 0
        : typeof x !== "string" || !x.isWellFormed()) ||
      Buffer.byteLength(JSON.stringify(value)) > maxBytes * 2)
    throw new HogletError("protocol-failure", "Malformed remote operation.");
  const op = TextOperation.fromJSON(value);
  const result = op.apply(base);
  if (!result.isWellFormed() || Buffer.byteLength(result) > maxBytes)
    throw new HogletError("protocol-failure", "Remote operation violates the document limit or Unicode boundary.");
  return op;
}
