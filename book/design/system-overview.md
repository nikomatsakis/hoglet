# System Overview

Hoglet runs locally and connects an MCP client to saved HedgeDoc services
using the user's HedgeDoc access, including sessions established through GitHub
login. The transport and CLI adapters validate requests, the shared application
layer applies operation contracts, and the HedgeDoc bridge performs service operations.

## Anchors

> **`A-cli-note-operations`** (draft): **CLI commands preserve the note-operation contract**
> Property: Local CLI commands discover saved services, read persisted Markdown, retrieve metadata and submit snapshot-checked replacements using the same application operations and service store as MCP. Top-level help lists commands and points to local skill instructions explaining authentication, session reuse and the read/edit workflow. Dedicated auth help explains browser login and manual headless session import. Help and skill do not access a service. Raw reads preserve content without an added newline; JSON reads carry service and snapshot provenance. Invalid input submits nothing and never echoes input secrets in diagnostics. Edit output distinguishes rejection, acknowledged acceptance, persistence observations and uncertainty, with nonzero status for unconfirmed results and no automatic retry.
> Authority: `R-cli-note-operations`; `R-multiple-services`; `R-note-content`; `R-service-access`; `D-snapshot-checked-ot`
> - Criterion `command-contracts` [test]: Through actual CLI processes, exercise default/explicit help, skill instructions, discovery, raw/JSON reads, metadata and edits on both transport fixtures, default/explicit/ambiguous service selection, invalid arguments and bounded file/stdin edit input. Verify help and skill exit without loading service configuration, help points to skill, and skill explains user authentication, session reuse, service selection, read-before-edit snapshots and unconfirmed-write handling. Verify dedicated auth help explains graphical login and manual headless import, including Firefox/Chrome cookie access, `/me` identity, private input, verification and cleanup. Verify explicit `mcp` and legacy `serve` commands initialize the protocol without help text on stdout. Assert exact Markdown, service-bound snapshots, exit codes, failed authentication, invalid edits with zero submissions, stale rejection, accepted/unconfirmed outcomes and absence of synthetic credentials from outputs.
> - Criterion `command-cancellation` [test]: Stall edit-input stdin and service responses, then interrupt actual CLI processes before and after submission. Assert bounded exit, connection cleanup, preserved acknowledgement/uncertainty observations and no retry or rollback.

> **`A-mcp-independent-install`** (draft): **Installed Hoglet owns its runtime**
> Property: The standalone launcher runs the packaged application with its pinned private Node, independently of working directory, source checkout, and system Node/npm selection. Local auth, browser installation and MCP use the same private runtime and existing user-scoped service store. Installation verifies the runtime archive before execution, preserves an existing working release until the new one is built, and refuses to overwrite an unrelated command.
> Authority: `R-private-node-runtime`; `R-local-mcp`; `R-macos-keychain`
> - Criterion `standalone-runtime` [test]: Install with system Node/npm unavailable or incompatible, move the installation away from the checkout and launch from another directory. Exercise version reporting, browser installation, synthetic browser auth, persisted-session reuse and actual MCP calls using the installed launcher. On macOS exercise native Keychain access. Reject a corrupt runtime archive and an unrelated destination command, preserving the prior installation and credentials. Record tested OS/architecture and untested targets.

> **`A-mcp-usable-tools`** (draft): **Clients can discover and invoke the declared tools**
> Property: A client using the supported MCP protocol revision and transport can initialize a Hoglet session, discover each supported tool's input schema, and invoke it according to the declared contract. Invalid arguments and service failures produce distinguishable protocol or tool errors rather than successful results. Standard output carries only protocol messages when using stdio.
> Authority: `R-mcp-hedgedoc`; `R-local-mcp`; `R-multiple-services`; `D-stdio-first`
> - Criterion `protocol-session` [test]: Exercise initialization, tool discovery, one successful call, invalid arguments, an unknown tool, and service failure through the actual server transport; capture stdout and verify that diagnostics never corrupt stdio protocol messages.
> - Criterion `tool-contracts` [test, review]: Review published schemas against the declared inputs and results, and exercise each advertised tool's success and error cases through MCP. Discover saved services, route identical note selectors to different services, reject an ambiguous omitted service and an unsaved destination, and verify service labels on results.

> **`A-mcp-bounded-calls`** (draft): **Calls finish or report their observation limit**
> Property: Every note call has a finite configured deadline and content limit. Deadline expiry and cancellation release local resources and report what is known about any submitted write; neither is evidence that a service write was undone. Shutdown stops new calls and closes owned HTTP, realtime, and login-helper resources within a configured grace period.
> Authority: `R-bounded-operations`; `R-local-mcp`
> - Criterion `deadline-outcomes` [test]: Through the actual MCP process, stall HTTP responses, realtime initialization, acknowledgement, and persistence readback; exceed input and response limits; cancel before and after submission. Assert bounded completion, classified outcomes, no replay, and that cancellation never claims rollback.
> - Criterion `process-lifecycle` [test]: Start, stop, and interrupt the server with active connections and a pending write; verify connection cleanup, rejection of new work, absence of a hanging child process, and preservation of uncertain-write reporting during graceful shutdown.

## Boundaries

The local MCP process holds independent bridges and user session state for
multiple services. Each bridge owns one origin and deployment prefix, cookie
jar, intended user, transport profile, edit queue and connection lifecycle.
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
| `list_services` | No arguments | Saved service URLs, user IDs and release profiles, without credentials | Local session-store discovery |
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

Each note tool also accepts an optional `service` hostname or HTTP(S) base URL.
It selects only a locally provisioned service; it never authorizes a new
destination or transfers another service's credential. Omission selects the
explicit CLI/environment default, or the only saved service. Multiple saved
services without a default require an explicit selection. Successful note
results identify the canonical service URL. `list_services` describes saved
sessions, not a fresh authentication check; note calls still validate `/me`.
A service provisioned after MCP startup is discoverable without restarting.

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

## CLI note operations

The CLI invokes the same validated application operations as MCP directly,
without launching an MCP subprocess. Each command owns a short-lived service
registry; note commands revalidate the selected service identity and close
their connections before exit. Bare `hoglet`, `hoglet --help` and `hoglet help`
print help and exit successfully before service configuration or session access.
Help lists commands and directs callers to `hoglet skill`, which prints local
Markdown instructions without accessing credentials or a service. The instructions
explain the LLM workflow: discover saved services, have the user complete browser
authentication when needed, reuse valid sessions, select a service, read before
editing with its returned snapshot, and reconcile unconfirmed writes without
blind retries. They distinguish direct CLI calls from an MCP client launching
the server.
`auth --help`, `login --help` and `import-session --help` share dedicated
authentication instructions, including the manual headless import procedure
in [Session Access](session-access.md#provisioning-boundary).
`hoglet mcp [SERVER]` explicitly starts the stdio MCP server; `serve` remains
an alias. Both accept an optional default service and keep stdout exclusive
to MCP protocol messages.

| Command | Input | Output |
| --- | --- | --- |
| `hoglet services` | No arguments | JSON object with saved `services`, without credentials |
| `hoglet read NOTE [--service SERVER] [--json]` | One note selector | Exact persisted Markdown by default; JSON with Markdown, service, snapshot and source with `--json` |
| `hoglet info NOTE [--service SERVER]` | One note selector | JSON metadata with canonical service |
| `hoglet edit NOTE [--service SERVER] --snapshot TOKEN --edits FILE` | Expected snapshot and a JSON replacement array | JSON write observations and resulting snapshot when available |

Service selection follows MCP's saved-service/default rules. `--service`
selects a hostname or full base URL; `HOGLET_SERVICE` supplies an optional
default. An omitted service is ambiguous when several are saved. The selector
grammar is unchanged. `--` ends option parsing for a selector beginning with
hyphens. `--json` is also accepted on commands already producing JSON.

An edits file contains `[{"old_text":"…","new_text":"…"}]`; `--edits -` reads
stdin. Input is bounded to six times the configured content limit plus 32 KiB
for JSON encoding/envelope overhead, with the configured call deadline for
reading it. The shared edit compiler still bounds decoded replacement content
and the resulting document. Missing/invalid snapshot syntax, malformed JSON
and schema-invalid input fail before contacting a service. Replacement
matching is validated against the live base before submission.
CLI edits never obtain a fresh snapshot automatically
to bypass a stale caller's checked base.

Exit status is zero for successful discovery/reads/metadata and `unchanged`
or `persisted-observed` edits; one for usage, authentication, service failures,
rejected edits and stale snapshots; two for `accepted` or `uncertain` edits.
All classified edit results go to stdout, including nonzero edit outcomes.
Operational errors without a write classification go to stderr as JSON.
SIGINT/SIGTERM abort active work and use status 130/143 while retaining any
observed write classification. Cancellation does not claim remote rollback.
No retry is implied by a nonzero exit status.

## Standalone installation

`./install.sh` bootstraps with shell, curl, tar and a SHA-256 utility, without
system Node or npm. It selects the host's macOS/Linux ARM64 or x64 official
Node archive using checked-in version and checksum pins. The verified runtime
builds an explicit copy of application sources with locked dependencies and
prunes development dependencies. Credentials and arbitrary checkout files are
never packaging inputs. Node's license and dependency notices stay in the
installation. Chromium is installed through that runtime into Playwright's
per-user cache; `--skip-browser` defers it to `hoglet install-browser`.
Linux desktop browser dependencies remain a host prerequisite.

Installations use `PREFIX/lib/hoglet/releases/<release>/` with application,
runtime and launcher files. The default prefix is `~/.local`; `--prefix` selects
another absolute directory. After a successful build and requested browser
installation, an atomic `current` symlink selects the release and
`PREFIX/bin/hoglet` resolves it. Earlier releases are retained. Updates use the
same installer; a failed build does not select its incomplete release.
An install lock serializes updates; after an interrupted installer, inspect
and remove its stale lock before retrying.
The launcher resolves symlinks and always executes its own Node. It excludes
host-wide Node preload/search hooks (`NODE_OPTIONS` and `NODE_PATH`) while
preserving service and XDG environment settings. Installation and updates leave
the service store outside the release tree. `hoglet --version` reports the
application and actual Node versions. The built tree can run after the source
checkout is removed and can move as a whole prefix with its relative symlinks.

Resources, prompts, history, revision browsing, deletion, and permission changes
are outside this tool surface. Additional operations require a coherent design
and roadmap update.
