# System Overview

Hoglet runs locally and connects an MCP client to a configured HedgeDoc service
using the user's HedgeDoc access, including sessions established through GitHub
login. The transport adapter validates requests, the application layer applies
tool contracts, and the HedgeDoc bridge performs service operations.

## Anchors

> **`A-mcp-usable-tools`** (draft): **Clients can discover and invoke the declared tools**
> Property: A client using the supported MCP protocol revision and transport can initialize a Hoglet session, discover each supported tool's input schema, and invoke it according to the declared contract. Invalid arguments and service failures produce distinguishable protocol or tool errors rather than successful results. Standard output carries only protocol messages when using stdio.
> Authority: `R-mcp-hedgedoc`; `R-local-mcp`; `D-stdio-first`
> - Criterion `protocol-session` [test]: Exercise initialization, tool discovery, one successful call, invalid arguments, an unknown tool, and service failure through the actual server transport; capture stdout and verify that diagnostics never corrupt stdio protocol messages.
> - Criterion `tool-contracts` [test, review]: Review published schemas against the declared inputs and results, and exercise each advertised tool's success and error cases through MCP.

> **`A-mcp-bounded-calls`** (draft): **Calls finish or report their observation limit**
> Property: Every note call has a finite configured deadline and content limit. Deadline expiry and cancellation release local resources and report what is known about any submitted write; neither is evidence that a service write was undone. Shutdown stops new calls and closes owned HTTP, realtime, and login-helper resources within a configured grace period.
> Authority: `R-bounded-operations`; `R-local-mcp`
> - Criterion `deadline-outcomes` [test]: Through the actual MCP process, stall HTTP responses, realtime initialization, acknowledgement, and persistence readback; exceed input and response limits; cancel before and after submission. Assert bounded completion, classified outcomes, no replay, and that cancellation never claims rollback.
> - Criterion `process-lifecycle` [test]: Start, stop, and interrupt the server with active connections and a pending write; verify connection cleanup, rejection of new work, absence of a hanging child process, and preservation of uncertain-write reporting during graceful shutdown.

## Boundaries

The local MCP process holds service configuration and user session state.
Authentication to HedgeDoc is distinct from the MCP client's local connection.
The MCP adapter owns protocol framing, lifecycle, tool discovery, validation,
and result encoding. The application layer owns note operations and their error
semantics. The HedgeDoc bridge owns HTTP, service URLs, session state, and upstream
response interpretation. This separation allows bridge fixtures and protocol
tests to assess different boundaries without replacing end-to-end acceptance.

The application is TypeScript on Node.js, governed by `D-typescript-node`.
The initial transport is stdio, governed by `D-stdio-first`. The supported MCP
revision is 2025-11-25, using the pinned TypeScript SDK in contributor guidance.
Diagnostics go to stderr. Tool results encode the same JSON observation in text
content and `structuredContent`; no output schema is advertised in this slice.

## Initial tool contracts

The tool surface includes raw reads and existing-note edits, as required by
`R-edit-existing-notes`. `D-http-note-access` selects HTTP access where the service
supports it; editing uses a version-compatible realtime bridge.

| Tool | Input | Successful result | Service operation |
| --- | --- | --- | --- |
| `read_note` | One note identifier or alias | Raw Markdown, service-scoped note reference, snapshot token, and content source | `GET /<NOTE>/download` |
| `get_note_info` | One note identifier or alias | Title, description, view count, creation time, and update time | `GET /<NOTE>/info` |
| `edit_note` | One note identifier or alias, expected snapshot token, and exact text replacements | Classified outcome, acceptance and persistence observations, resulting snapshot when available, and observed concurrency | Authenticated Socket.IO editing session |
| `create_note` (optional) | Markdown, with an optional alias | The created note identifier and URL | `POST /new` or `POST /new/<ALIAS>` |

Inputs use an identifier or alias within the configured service, rather than an
arbitrary request URL. The bridge preserves a service base path and encodes note
references as path components. The supported selector grammar, including any
published-link form, is shared by all tools. A selector starts with a Unicode
letter/digit, underscore or hyphen; subsequent characters may additionally
include dot or space, with a 200-character limit. Paths, full URLs, percent
escapes and published `/s/...` forms are unsupported in this slice.

`read_note` returns persisted HTTP content; it labels that source because the
stored document can lag active realtime edits. Its token identifies the exact
returned text and is bound to the configured service and note selector, rather
than an HTTP timestamp or a permanent OT revision.
Note text is data, never server configuration or instructions.
`create_note` is a write operation with an
explicit success or uncertain-outcome result as defined in the bridge. Tool
descriptions expose these effects to clients.

`edit_note` changes the Markdown of an existing note using the intended user's
service permissions. Its contract specifies how a caller relates the edit to
the content it read, how concurrent changes are handled, and which observations
justify the result. Each replacement supplies `old_text` and `new_text`; all
matches refer to the same base snapshot and must be unique and nonoverlapping.
An empty edit list is invalid. Empty `old_text` is allowed only as the sole edit
to an empty document. Missing or ambiguous matches cause no submission.
A dedicated whole-document replacement mode, numeric offsets, and arbitrary OT
arrays are outside this initial contract. Insertions into a nonempty document
use a replacement of unique surrounding text.

The bridge defines concurrency and write observations. Tool results carry a
machine-readable outcome plus structured observations; callers do not have to
infer whether a write happened from prose. Invalid MCP requests and invalid
arguments use protocol/SDK validation errors; operational failures and
unconfirmed write outcomes are surfaced as tool errors with their structured
classification. `unchanged` and `persisted-observed` have `isError: false`;
stale, rejected, uncertain and accepted-without-persistence results have
`isError: true`. Read and metadata failures return a structured `error`
with nonsecret `code` and `message`. SDK validation failures remain distinguishable
from bridge outcome classifications. A canceled MCP request receives no reply
under the SDK's protocol behavior; stderr retains only nonsecret write
observations, never note text or credentials.

Session acquisition is a separate local command or helper, outside MCP note
tools, as described in [Session Access](session-access.md).

Resources, prompts, history, revision browsing, deletion, and permission changes
are outside this tool surface. Additional operations require a coherent design
and roadmap update.
