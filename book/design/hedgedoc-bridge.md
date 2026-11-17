# HedgeDoc Bridge

The bridge translates note reads into HTTP and existing-note edits into
HedgeDoc's collaborative realtime protocol. It preserves content, relates
edits to the caller's snapshot, and reports only the write observations it has.
[Session Access](session-access.md) governs its identity and request boundary.

## Anchors

> **`A-notes-faithful-content`** (draft): **Note content reflects the service's Markdown**
> Property: A successful read returns the raw Markdown supplied by HedgeDoc without rendering or rewriting it. Its snapshot token identifies that exact content within its service and note scope, and its source distinguishes persisted from live content. Optional creation sends text/markdown and returns the service's identity, documenting upstream normalization rather than claiming byte-for-byte storage.
> Authority: `R-note-content`; `D-http-note-access`
> - Criterion `markdown-roundtrip` [test]: Read empty, Unicode, multiline, CRLF, frontmatter-bearing, and instruction-like notes through MCP against independent fixtures and a real supported service; compare returned Markdown with supplied content. When creation is enabled, compare submissions and stored downloads and account for carriage-return and NUL normalization. No note content may become configuration or an instruction to the server.
> - Criterion `snapshot-provenance` [test]: Exercise a persisted download lagging the live document, unchanged content with different metadata, changed content, a different note/service using identical text, and a live connection reset. Assert content-source labels and snapshot binding; neither metadata timestamps nor a reused OT revision may authorize an edit of different content or another note.

> **`A-notes-precise-edits`** (draft): **Edits change only the selected text in their checked base**
> Property: For a matching live snapshot without concurrent remote operations, Hoglet's operation produces exactly the requested replacements and preserves all other Markdown. All replacements resolve uniquely and without overlap against one base; invalid, missing, ambiguous, or overlapping edits submit nothing. Valid Unicode is indexed consistently with HedgeDoc's UTF-16 operations without splitting surrogate pairs. Unsupported NUL input is rejected before submission.
> Authority: `R-edit-existing-notes`; `R-note-content`; `D-typescript-node`
> - Criterion `replacement-validation` [test]: Exercise single and multiple replacements, deletion, insertion using surrounding text, an empty document, no-op edits, repeated and absent matches, overlapping ranges, empty lists, and malformed or NUL-containing input. Compare independently specified expected Markdown and submitted operation counts; every invalid batch must produce zero submissions.
> - Criterion `unicode-operations` [test]: Apply operations over ASCII, non-BMP characters, combining marks, multiline text, CRLF, and frontmatter using independently specified results and the upstream OT implementation as an additional oracle. Exercise JSON encoding and a real realtime connection, verify full base consumption and UTF-16 lengths, and detect any split surrogate pair or rewrite outside the selected text.

> **`A-notes-observable-edits`** (draft): **Existing-note edits have explicit concurrency and outcome semantics**
> Property: Hoglet rejects a stale caller snapshot before submission, then reconciles and reports observed collaborative changes during a submitted edit under the intended user. It reports protocol acceptance, observed persisted content, rejection before submission, and uncertainty distinctly. The preflight check is not atomic with server application and does not guarantee the semantic intent of overlapping edits. A named acknowledgement is not a durable-storage guarantee; a timeout is not proof of rejection. Hoglet never automatically replays an uncertain edit or rolls back remote content to resolve a mismatch.
> Authority: `R-edit-existing-notes`; `R-github-session-access`; `D-snapshot-checked-ot`
> - Criterion `authenticated-edit` [test]: Through MCP, read and edit an existing disposable note using a GitHub-established HedgeDoc session on each supported release. Verify the intended user, resulting Markdown, named acknowledgement, and database-backed readback. An unauthorized or read-only user must not obtain confirmed edit success.
> - Criterion `concurrent-edit` [test]: Use a compatible second client to change disjoint and overlapping text before submission, between snapshot check and server application, and before/after acknowledgement. Exercise stale snapshots, queued calls including different aliases for the same note, repeated text, revision resets, and remote operations arriving before ack. Assert the declared rejection/merge policy, consistent observed content, and truthful concurrency reporting; do not claim an atomic unchanged-content precondition.
> - Criterion `edit-outcomes` [test]: Exercise named acknowledgement versus Socket.IO callback ack, silent permission and length rejection, malformed/reset responses, disconnect before and after server application, delayed/failed database save, and NUL normalization already present in a note. Assert result observations and operation counts. Missing acknowledgement is uncertain after possible submission; acknowledged content without matching readback is accepted with persistence unobserved. Reconnection, timeout, cancellation, or readback mismatch must never resend or roll back the write.

> **`A-service-compatible-transports`** (draft): **Declared releases satisfy one note-tool contract**
> Property: The supported set includes HedgeDoc 1.10.3 and an explicitly selected newer 1.x release in the Socket.IO 4 / Engine.IO 4 family. Every declared release and configuration passes the same note-tool semantics using its matching transport. An unsupported or undetermined transport fails explicitly before editing instead of assuming compatibility or cycling through write attempts. Reconnection obtains a fresh document generation and never carries an old operation revision into a new one.
> Authority: `R-mcp-hedgedoc`; `R-edit-existing-notes`; `D-typescript-node`; `D-dual-transport-targets`
> - Criterion `release-matrix` [test, review]: Review a declared release/configuration matrix containing 1.10.3 and the selected newer-family release; execute identity, read, edit, UTF-16, concurrency, outcome, prefix, and reconnect cases on every entry. Test a protocol-family mismatch and an unsupported/undetermined target with zero submitted edits. Record exact service, client, and application revisions; a shared Socket.IO generation alone does not establish support for an untested HedgeDoc release.

> **`A-notes-truthful-creation`** (draft): **Creation outcomes do not hide uncertain writes**
> Property: When creation is advertised, Hoglet reports success only after validating the service's creation response and note identity. A connection failure after possible submission is uncertain when the service may have created the note; Hoglet never automatically retries that creation.
> Authority: `R-write-outcomes`
> - Criterion `creation-outcomes` [test]: Exercise a valid creation redirect, login redirect, missing or invalid identity, disabled creation, alias conflict, normalization, and connection loss after the fixture records the write. Assert classifications and exactly one submission in uncertain cases.

## HTTP reads and snapshots

Use `GET /<NOTE>/download` for raw persisted Markdown and `GET /<NOTE>/info` for
metadata. Parse status, content type, and expected response shape. The metadata
fields are `title`, `description`, `viewcount`, `createtime`, and `updatetime`;
they are not edit preconditions. Preserve content exactly after valid UTF-8
decoding; reject malformed encoding rather than silently replacing characters.

Do not open the bare editor page for discovery: FreeURL handling can create a
missing note. Specific actions avoid that editor-page path, but upstream
resolution of built-in documentation aliases can still create/update records.
Hoglet does not claim that every nominal read is free of upstream side effects.
History is viewed-note history, not a complete permission-aware note listing.

Snapshot tokens bind the configured service, the note selector, and exact
decoded content with an unambiguous encoding and a content fingerprint.
Tokens express content equality, not permission, permanent server revisions, or
an atomic lock. The same content in another scope does not satisfy the token.
HTTP downloads may lag the live document; return `source: persisted` explicitly.

## Checked text edits

An edit contains an expected snapshot token and a nonempty list of exact
`old_text`/`new_text` replacements. Find all matches against the same fresh live
base. Require each nonempty old text to occur exactly once and reject overlapping
ranges. The sole empty-old-text case inserts into an empty base. Adjacent ranges
are valid. Equal old and new text is a no-op; if every replacement is a no-op,
report `unchanged` without sending an operation.

Reject NUL in submitted old/new text and invalid Unicode input, rather than
silently normalize it. Existing note content may contain live NUL characters;
preserve them in the operation and distinguish the service's normalized stored
representation in readback. Do not perform Unicode normalization or rewrite
line endings.

Compile the batch to one minimal UTF-16 OT operation, retaining untouched text
and consuming the entire base. Retain shared prefixes and suffixes within each
replacement, preserving complete surrogate pairs at every boundary.
Numeric OT offsets and arbitrary OT arrays are
internal, never caller inputs. Reuse upstream OT semantics with its license
and dependency provenance recorded before copying or packaging code.

## Realtime editing and concurrency

Connect to namespace `/` at the configured `/socket.io/` path, with `noteId` in
the handshake query and the validated service session. Use WebSocket without
polling fallback; the deployment must permit this transport. Register handlers before
connecting and wait for both `doc` and `refresh`. The document revision is an
in-memory operation count, scoped to this connection/document generation.
Serialize edits for the configured service in the initial implementation, so
different aliases for the same note cannot bypass the queue. Recheck each
queued call's snapshot when it reaches the queue head; the call deadline
includes queue time. Allow at most one pending operation while processing remote
operations continuously. Per-note queues are an optimization only after note
identity can be resolved consistently across selectors.

Compare the caller's token with fresh live content before submission. A mismatch
returns `stale-snapshot`, no operation, and a current snapshot when readable.
Validate the complete replacement batch before sending. An operation is the
named `operation` event with three positional arguments: revision, encoded OT,
and null selection. Track the named `ack` event, not callback acknowledgement.

`D-snapshot-checked-ot` defines stale rejection followed by collaborative
reconciliation after submission. If a received remote operation changes the
checked base before handoff to the transport, reject the now-stale request
without submitting. Stock reviewed HedgeDoc can still receive another edit
between that handoff and server application; it transforms stale operations and
supplies no atomic compare-and-swap. The client must reconcile remote operations
with pending local operations, including remote events arriving before ack.
Its result reports the reconciled content it observed and whether concurrent
operations were observed; absence of observed concurrency is not proof that
no other editor acted. Structural OT convergence does not guarantee prose intent.

Connection loss or a replacement `doc` can invalidate the old revision and
local state. Reconnect/resnapshot for observation, never to resend an uncertain
operation. Disable automatic operation buffering/resend across reconnection,
including the upstream browser client's resend behavior; a new connection starts
without an outstanding operation to retransmit. A matching resnapshot without
ack does not prove this client caused the content, so it cannot upgrade uncertain
acceptance to confirmed acceptance.

## Write observations

Keep operation outcome and persistence observations separate:

| Outcome | Required observation | What the caller may rely on |
| --- | --- | --- |
| `unchanged` | Checked live content already satisfies all no-op replacements | No operation submitted |
| `stale-snapshot` | Caller token differs from the live base | No operation submitted; caller must reconcile with current content |
| `rejected` | Validation/preflight failure or explicit rejection that establishes no application | No confirmed edit; include only a known reason |
| `accepted` | Named ack and reconciled operation state | Applied to the live document; persistence not observed |
| `persisted-observed` | Accepted operation plus matching database-backed readback of an identified reconciled snapshot | That content was observed stored at that time |
| `uncertain` | Submission may have occurred but acceptance is unestablished | Re-read and reconcile before considering a new edit |

Include `submitted`, `acceptance`, and `persistence` observations so a later
authentication or readback error never erases a known ack. Snapshot tokens and
returned content identify their observation source. `concurrency_observed` is an
observation, not a guarantee about the whole note's edit history.

Database persistence runs separately from OT acceptance. `check` supplies
metadata, not an operation-specific commit receipt. After ack, observe bounded
HTTP readback against an identified reconciled snapshot, accounting for known
NUL normalization. If concurrent edits prevent a defensible match, keep
persistence unobserved. Do not claim that readback proves this operation remains
unchanged forever, that a historical revision was saved, or that data was fsynced.

All waits and content have configured finite limits. If a deadline expires after
ack, retain `accepted` and report persistence unobserved. If acceptance is unknown
after possible submission, use `uncertain`. Silence does not distinguish
permission rejection, an oversize operation, loss, and server application
followed by disconnect.

## Compatibility and optional creation

Stock 1.10.3 uses Socket.IO 2 / Engine.IO 3; the 1.10.4 boundary switches to
Socket.IO 4 / Engine.IO 4. Select a pinned matching client backend using a
declared target profile. Version discovery is a read-only check, not proof of
full compatibility. A protocol mismatch must never lead to a trial write.
The verification matrix records exact tested releases and relevant settings.
`D-dual-transport-targets` requires entries for 1.10.3 and an explicitly selected
newer-family 1.x release. This support set does not require existing servers to
upgrade or imply support for every intervening release.

When creation is included, use `POST /new` or `POST /new/<ALIAS>` with
`text/markdown`, honor FreeURL and creation policies, and validate the creation
redirect before claiming success. HedgeDoc removes carriage returns on creation
and NUL on storage. A failed response after submission cannot safely trigger a
retry. Creation is an optional separately scoped capability; it is not required
to satisfy existing-note editing.
