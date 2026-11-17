# HedgeDoc 1.x APIs for a local read/edit MCP server

Prepared 2026-11-16 for Hoglet's assigned API investigation. This is research and
an implementation recommendation, not accepted goal design or evidence that
Hoglet implements any server behavior.

## Main findings

The reviewed source supports a local MCP process reading and editing HedgeDoc
through the browser's session and editing protocol. Authenticated behavior on
the example services remains to be tested. Reading is ordinary HTTP; editing an
existing note uses Socket.IO events carrying operational transformation (OT)
operations. GitHub login establishes a **HedgeDoc session**, not a GitHub
bearer-token API for notes.

Both supplied services returned `HedgeDoc-Version: 1.10.3` on a passive GET of
their landing page. That matters: upstream 1.10.3 uses Socket.IO 2 and Engine.IO
protocol 3, while 1.10.4 and the reviewed later tags use Socket.IO 4 and Engine.IO
protocol 4. The current `rust_socketio` client documents support for the newer
protocol only. Choosing it without a legacy compatibility plan would miss the
actual examples.

The strongest first prototype is:

1. Provision one authenticated HedgeDoc session per configured origin; confirm
   its identity with `/me`.
2. Read Markdown over HTTP, and establish a live Socket.IO document before
   editing.
3. Accept snapshot-checked, exact text edits; compile them to minimal OT
   operations using JavaScript-compatible UTF-16 indices.
4. Wait for the named `ack` event, reconcile concurrent operations, and separately
   observe database-backed readback. Never equate an OT acknowledgement with
   durable storage.
5. Exercise 1.10.3 first, then add an explicitly tested newer-protocol backend.

## Evidence, scope, and deployment observations

The primary source checkout is `~/dev/hedgedoc`, clean at
`dbb71bae523af1dfba30006e4922143d8004f741`, package version 1.12.2, with upstream
origin `git@github.com:hedgedoc/hedgedoc.git`. To understand the actual deployments,
this investigation also read the local upstream tag 1.10.3, commit
`d8b94026ee927213eda14973dd4386ea9e6389c0`, using `git show`, without changing that
checkout.

| Target | Passive observation on 2026-11-16 | What remains unverified |
| --- | --- | --- |
| `https://hedgedoc.nikomatsakis.com/` | HTTP 200; version header 1.10.3; session cookie name `connect.sid`; landing page links to `/auth/github` | Authenticated identity, note permissions, installed patches, proxy behavior, editing, and storage |
| `https://hedgedoc.symposium.dev/` | HTTP 200; version header 1.10.3; session cookie name `connect.sid`; landing page links to `/auth/github` | The same unverified boundaries |

Requests did not follow redirects, initiate login, access notes, connect realtime
sessions, or write data. Cookie values were neither printed nor retained in the
report. A deployment header identifies its reported version, not its exact
source revision; a patched deployment can differ from the upstream tag.

The sandbox initially could not resolve public hosts. The same read-only
requests succeeded with approved network access. Primary Socket.IO, Rust-client,
Express-session, and Playwright documentation was retrieved for compatibility
and login-helper analysis. Official HedgeDoc documentation was reachable with
the research user agent; a later default-user-agent request was forbidden.
The complete API Markdown and implementation were available locally throughout.

No authenticated acceptance test was possible because the investigation had no
user session. Source observations, passive headers, small local OT experiments,
and architectural recommendations are distinguished below.

## HTTP API inventory

The note router registers the listed actions directly under the configured
service base path. There is no general `/api/v1/notes` REST resource in the
reviewed implementation. The local API document and OpenAPI file are useful
inventories, but do not cover the realtime edit protocol.

| Operation | HTTP surface | Result and important limits |
| --- | --- | --- |
| Read persisted Markdown | `GET /<NOTE>/download` | Raw `text/markdown; charset=UTF-8`; reads the Note model's stored content after view permission checks |
| Read published Markdown | `GET /s/<SHORT-ID>/download` | Same download action; useful for a published link, but not a distinct authorization model |
| Read metadata | `GET /<NOTE>/info` | JSON with `title`, `description`, `viewcount`, `createtime`, `updatetime`; no edit capability or OT revision field |
| List saved revisions | `GET /<NOTE>/revision` | JSON `{ "revision": [{ "time": <milliseconds>, "length": <length> }, ...] }`, newest first |
| Read saved revision | `GET /<NOTE>/revision/<timestamp>` | JSON `{ "content": <Markdown>, "patch": <parsed diff-match-patch array>, "authorship": ... }`; timestamps refer to stored historical revisions, not live OT revisions |
| Establish current identity | `GET /me` | Authenticated JSON `{ "status": "ok", "id": ..., "name": ..., "photo": ... }`; unauthenticated response can be HTTP 200 with `{ "status": "forbidden" }` |
| List user's history | `GET /history` | `{ "history": [...] }`; viewed-note history, not all notes a user can read or edit |
| Create note | `POST /new`, `Content-Type: text/markdown` | Creates a new note and redirects to its URL; content has carriage returns removed |
| Create aliased note | `POST /new/<ALIAS>` | Same creation path, requiring enabled FreeURL and any configured authentication policy; existing aliases conflict |
| Replace or pin history | `POST /history` or `/history/<NOTE>` | Form-encoded history replacement or `pinned=true/false`; this is user-history mutation |
| Remove history | `DELETE /history` or `/history/<NOTE>` | Removes history only; does not delete a note. Token requirements differ by release |
| Export owned notes | `GET /me/export` | ZIP of owned notes; not a complete permission-aware list of every accessible note |
| Open published/slide form | `GET /<NOTE>/publish`, `/slide` | Redirect to a browser-oriented view |
| Service status | `GET /status`, `/metrics`, `/_health` | Status/metrics can depend on instance settings; useful diagnostics, not note APIs |
| Client configuration | `GET /config` | JavaScript generated from `constant.ejs`, **not JSON**; its fields differ by version |
| Edit existing note | No reviewed HTTP endpoint | Use the authenticated realtime protocol described below |

Sources: 1.12.2 `lib/web/note/router.js:20–39`,
`lib/web/note/controller.js:84–141`, `lib/web/note/actions.js:9–93`,
`lib/models/revision.js:112–156`, `lib/web/userRouter.js:16–42`,
`lib/history.js:121–203`, and `lib/web/statusRouter.js:36–56`.
Revision reconstruction returns its fields from `lib/workers/dmpWorker.js:126–135`.
The note action names and main read/create contracts are also present in 1.10.3.
Use the pinned-source links in the appendix to inspect either revision.

Several details affect an MCP adapter:

- Do not obtain content from rendered HTML or open the bare note page to discover
  a nonexistent alias: editor-page handling can create notes in FreeURL mode.
  Download and metadata routes avoid that editor-page creation path.
- Parse response status **and** expected shape/content type. A forbidden identity
  JSON body or a login HTML page is not successful content.
- Creation is a write despite the existence of a `GET /new` route. The MCP server
  should use explicit POST, inspect the creation redirect without blindly
  following it, and never retry an uncertain creation automatically.
- Public/published short IDs and ordinary note IDs can resolve to the same note.
  `Note.parseNoteId` tries aliases, legacy LZString identifiers, Base64URL UUIDs,
  and short IDs. Preserve case and keep the origin/base path fixed.
- Certain built-in documentation aliases can create/update database records from
  files during ID resolution. A universal claim that every nominal read has zero
  upstream side effects would be too strong.
- The normal HTTP download is database-backed. During active editing it can lag
  the live realtime document; this matters for snapshots and immediate readback.

Sources for those qualifications: 1.12.2
`lib/web/note/controller.js:59–81`, `lib/web/note/util.js:9–109`,
`lib/models/note.js:167–327`, and `lib/realtime.js:80–177`.

## GitHub authentication and session ownership

### What GitHub sign-in actually gives the client

The service owns the OAuth application and its registered callback at
`<service-base>/auth/github/callback`. `/auth/github` invokes Passport's GitHub
strategy; its callback associates the GitHub identity with a HedgeDoc User.
Passport serializes the **HedgeDoc user ID** into the service session, whose
data is stored server-side in a Sequelize session store. The browser carries
the signed session-ID cookie.

The local MCP process needs that service session. A GitHub personal access token,
GitHub CLI login, or device-flow token is not a replacement: the reviewed note
routes do not authenticate GitHub bearer tokens or expose an exchange endpoint
that turns one into a HedgeDoc session.

Sources: 1.10.3 `lib/web/auth/github/index.js:12–28`,
`lib/web/auth/index.js:12–35`, and `app.js:174–187,264–274`;
1.12.2 `lib/web/auth/utils.js:10–71`.

The 1.12.2 GitHub strategy explicitly sets `pkce: true` and `state: true`.
The 1.10.3 source does not contain those options. Do not describe newer auth
options as implemented by the supplied sites solely because they appear in
the master checkout.

### HTTP and realtime use the same cookie

Default cookie name is `connect.sid`; default session lifetime is 14 days, with
the actual lifetime and name configurable. Both reviewed versions set
`rolling: true`, so ordinary service responses renew cookie expiration.
An HTTP client should maintain a scoped cookie jar and accept authenticated
`Set-Cookie` updates from the configured origin.

The app supplies SameSite and Secure settings but does not override Express
session's default HttpOnly, root path, and host-scoped domain behavior. Thus a
normal page script cannot read the session through `document.cookie`. Preserve
the original cookie's name, encoded value, domain, path, Secure flag, and
expiry; do not strip its signature or turn it into an Authorization header.

`realtime.secure` requires a correctly signed cookie before the Socket.IO
authorization middleware looks up the session. The Passport Socket.IO failure
handler permits guest usage; a valid anonymous cookie is therefore insufficient
to establish the user identity required for authenticated edits. `/me` is the
simple identity check.

Sources: 1.12.2 `lib/config/default.js:61–69`,
`app.js:187–199,287–298`, and `lib/realtime.js:34–63`;
equivalent 1.10.3 `app.js:174–187,264–279` and
`lib/realtime.js:33–62`; Express-session primary documentation in the appendix.

### Provisioning options for a local process

| Option | Works without operator OAuth changes? | Recommendation and limitation |
| --- | --- | --- |
| Explicit import of the HedgeDoc cookie from a logged-in browser | Yes | Good first controlled prototype; expose a dedicated local login/configuration action, never an MCP tool that asks the model to supply or print a cookie |
| Controlled browser login helper | Yes, as an architectural option | Launch a browser context; user performs normal GitHub login on the service; helper exports only cookies affecting the configured HedgeDoc origin using privileged browser APIs |
| Browser extension or a deliberately configured browser automation attachment | Yes, with browser permissions/setup | Can reuse an existing browser login; added distribution and local permission requirements need design |
| Open system browser, wait on a localhost callback, and expect the remote cookie | No, by itself | The existing OAuth callback goes to the remote service. Same-origin boundaries prevent a local page from reading the remote HttpOnly session |
| Make Hoglet's own GitHub OAuth application/device login | No useful automatic exchange | Obtains a GitHub credential; the reviewed HedgeDoc APIs do not accept it as note authentication |
| Transparent local reverse proxy of the service's login | Not a simple drop-in solution | OAuth callback URL, cookie scope, origin, URLs, TLS, and redirects remain tied to the real service; do not select this as the first path |
| New upstream token/session-exchange endpoint | Requires service changes | Potential cleaner future API, but not a capability of stock reviewed 1.x deployments |

A browser helper does not need to reroute OAuth to localhost: it observes the
completed login in the browser context that went to the **existing remote
callback**, obtains cookies through the browser's privileged cookie API, and
verifies the resulting HedgeDoc identity. Playwright's `browserContext.cookies`
supports origin filtering and includes cookie metadata, including HttpOnly.
The helper can then send the minimal HedgeDoc credential to a local process
through a private IPC channel.

Do not save a complete browser storage-state export by default: that can include
GitHub cookies and unrelated secrets. Filter to the configured HedgeDoc origin
and required cookie, use a protected credential store or restrictive local file,
and redact diagnostics. A separate browser context may require the user to log
in again. Reusing an existing profile requires deliberate browser support;
opening a web page does not itself provide cookie extraction.

This is a viable **design proposal**, not a tested login workflow. A prototype
must assess actual browser launch/profile availability, GitHub interactive
authentication, credential storage, logout, expiration, and identity switching.
Realtime sockets retain identity loaded during the handshake; the inspected
operation permission check is not a fresh session-store lookup on each edit.
Hoglet should therefore revalidate `/me` around writes and close/reconnect
realtime sessions when identity becomes invalid or changes. Socket activity
alone should not be assumed to renew HTTP cookie expiry.

### CSRF tokens are not note API credentials

The reviewed Socket.IO operation handler authenticates through the session and
checks the note permission; it does not require the history-deletion token.
The newer HTTP history deletion implementation checks the user's `deleteToken`,
exposed as `userToken` by `/config`; the 1.10.3 handler does not perform that
check. Do not transfer that token requirement to the realtime edit protocol or
mistake the token for general API authentication.

Sources: 1.12.2 `lib/history.js:176–203`,
`lib/web/statusRouter.js:36–56`, and
`lib/ot/editor-socketio-server.js:43–74`; 1.10.3
`lib/history.js:176–198` and `lib/web/statusRouter.js:105–122`.

### Permissions are note-specific

| HedgeDoc permission | Who can read? | Who can edit? |
| --- | --- | --- |
| `freely` | Everyone | Everyone |
| `editable` | Everyone | Logged-in users |
| `limited` | Logged-in users | Logged-in users |
| `locked` | Everyone | Owner |
| `protected` | Logged-in users | Owner |
| `private` | Owner | Owner |

These are the recognized values in the reviewed code. The read and edit checks
are separate. A successful download or GitHub login does not establish edit
permission for that note. `refresh` gives owner and permission data that the
client can use for preflight checks; the server's write check remains decisive.

Sources: 1.10.3 `lib/web/note/util.js:43–50`,
`lib/realtime.js:366–374,620–647`; 1.12.2
`lib/permissions.js:1–23`, `lib/realtime.js:611–643`.
The newer code additionally rejects unknown permission values explicitly.

## Version-sensitive transport compatibility

The following exact upstream tags were inspected through their `package.json`.
This is a dependency inventory, not a claim that every intervening release has
been tested.

| HedgeDoc tag | Socket.IO server | Browser Socket.IO client | Protocol family |
| --- | --- | --- | --- |
| 1.8.0 | `^2.1.1` | Not separately listed in the inspected development dependencies | Legacy family; not a selected acceptance target |
| 1.9.9 | 2.5.0 | 2.5.0 | Socket.IO protocol 4, Engine.IO protocol 3 |
| 1.10.3 | 2.5.1 | 2.5.0 | Same legacy family; both supplied sites report this HedgeDoc version |
| 1.10.4 | 4.8.1 | 4.8.1 | Socket.IO protocol 5, Engine.IO protocol 4 |
| 1.10.8 | 4.8.3 | 4.8.3 | Newer family |
| 1.11.0 / 1.11.1 / 1.12.0 | 4.8.3 | 4.8.3 | Newer family |
| 1.12.2 | 4.8.4 | 4.8.4 | Newer family |

**The transport boundary begins at 1.10.4**, not at a major HedgeDoc release.
Socket.IO is not a plain WebSocket JSON stream. Engine.IO handles transport
handshake, polling, upgrade, framing, and heartbeats; Socket.IO adds namespace
connection and event framing. The legacy handshake uses `EIO=3`; the newer one
uses `EIO=4`, with heartbeat and connection differences. Changing only the query
parameter on a newer library does not implement the older protocol.

The current Rust client primary README explicitly documents Socket.IO protocol
5 and Engine.IO protocol 4. It offers headers, TLS configuration, and sync/async
clients for that family, but its async interface is marked experimental.
Its `opening_header` supports supplying Cookie on transport requests; it is not
evidence of Engine.IO 3 support or automatic integration with an external
HTTP cookie jar.

| Implementation route | Assessment |
| --- | --- |
| Current `rust_socketio` for all 1.x | Reject as an untested compatibility assumption; documented family misses stock 1.10.3 |
| Native Rust dual-version transport | Fits Hoglet's Rust implementation, but legacy framing, heartbeat, upgrade, reconnection, headers, and event argument handling need a bounded implementation/acceptance spike |
| Pinned Node adapter with `socket.io-client` 2.5.0 for the first spike | Matches the 1.10.3 browser dependency; quickest way to isolate server/auth/OT behavior from a new legacy transport implementation |
| Add a pinned Node Socket.IO 4 adapter or tested Rust newer backend | Suitable second compatibility target; choose by verified behavior and packaging requirements |
| Ask operators to upgrade first | Removes the legacy target if explicitly chosen, but is a product/environment decision, not a prerequisite silently inferred by Hoglet |

A Node adapter would add a runtime/distribution dependency; it is an optional
prototype recommendation, not an accepted architectural decision. JavaScript
also offers a practical oracle for UTF-16 OT behavior. A browser-controlled
bridge is another transport prototype, at the cost of keeping a browser context
alive.

Primary Socket.IO documentation describes Node custom headers and the
incompatibility between the legacy and newer families. Sending session Cookie
headers from Node/native code is different from using the browser WebSocket API,
which does not permit arbitrary request headers. Preserve the endpoint path
`/<deployment-prefix>/socket.io/`; do not confuse that path with a namespace.

## Realtime protocol, step by step

### Connection and initial snapshot

1. Create an HTTP cookie jar for the configured service; GET `/me` and require
   `status: "ok"` with the expected HedgeDoc user ID.
2. Register realtime event handlers **before connecting**, because the initial
   document can arrive immediately.
3. Connect to namespace `/`, using the appropriate Engine.IO family, transport
   path, and a handshake query field `noteId=<identifier>`. Send the same scoped
   service cookie in the handshake. There is no separate application-level
   `join` event to invent.
4. The server resolves the note ID, checks view permission, adds the socket to
   the note room, and sends:

   ```json
   ["doc", {
     "str": "Hello",
     "revision": 7,
     "clients": {}
   }]
   ```

5. It also sends `refresh` containing owner, permission, `docmaxlength`, title,
   authorship, and timestamps. Receive `doc` and `refresh` before allowing edits;
   verify identity and note permission rather than treating socket connection
   as authorization.
6. An optional `version` request produces version and
   `minimumCompatibleVersion`; it does not replace transport negotiation.

The JSON examples represent **Socket.IO event argument arrays**, not an entire
HTTP body or WebSocket frame. A Socket.IO library encodes them. Exact frame
prefixes and handshake sequence depend on protocol family.

Sources: 1.12.2 `public/js/index.js:2214–2223`,
`lib/realtime.js:276–296,320–337,372–505,692–745,876–881`,
and `lib/ot/editor-socketio-server.js:34–43`;
1.10.3 `lib/ot/editor-socketio-server.js:34–43` has the same application message.

### Operation encoding and acknowledgements

The client sends an event with **three positional arguments**:

```json
["operation", 7, [5, " world"], null]
```

This says: against the snapshot at OT revision 7, retain five UTF-16 code units
and insert `" world"`. For the `"Hello"` document it yields `"Hello world"`.
The optional selection is `null`; a headless MCP editor does not need browser
cursor UI.

The operation JSON is a sequence:

| Element | Meaning |
| --- | --- |
| Positive integer | Retain that many UTF-16 code units |
| String | Insert text |
| Negative integer | Delete that many UTF-16 code units from the input |

An operation must consume the entire base string through retained/deleted
lengths. Zero integer elements are invalid; empty actions are omitted. Numeric
offsets must use JavaScript string semantics: `"😀".length` is 2, while Rust
UTF-8 byte length is 4 and Unicode scalar count is 1. Do not split a surrogate
pair when computing user edits.

For `"Hello world"` to `"Hello HedgeDoc"`:

```json
["operation", 8, [6, "HedgeDoc", -5], null]
```

The upstream builder canonicalizes insertion before deletion at the same
position. For an empty document, insertion can simply be `["Hello"]`.

The successful server responses are:

```json
["ack", 8]
["operation", "<other-client-id>", 8, [5, " world"], null]
```

The author receives the named **`ack` event**; other clients receive the
`operation` event. This is not Socket.IO's callback acknowledgement mechanism.
Calling a library's generic `emit_with_ack` waits for a different protocol
response that this handler does not implement.

Sources: 1.12.2 `lib/ot/text-operation.js:39–57,64–125,156–208`,
`lib/ot/editor-socketio-server.js:105–131`,
`public/vendor/ot/socketio-adapter.js:19–47`;
1.10.3 `lib/ot/editor-socketio-server.js:92–129`.

### Concurrency and revision meaning

The OT server transforms an incoming operation against operations after its
submitted revision, applies it to the current live document, increments the
operation count, and acknowledges that count. The server does not reject every
stale edit. Clients must handle incoming remote operations while an operation
is awaiting confirmation, transform the outstanding operation, and maintain a
consistent local document.

The browser's client states include synchronized, awaiting confirmation,
awaiting confirmation with buffered edits, and stale/recovery. For a first MCP
backend, serialize tool writes per note and allow at most one outstanding
operation, but still process other users' operations during that wait.

The `doc.revision` integer is the current in-memory operation-list length. It
is not a saved-revision timestamp, an HTTP ETag, or a permanent note version.
When the live document is unloaded and later reinitialized, history can start
again at zero. Scope any revision token to a connection generation and note;
use a content fingerprint to connect a caller's earlier read to a fresh
snapshot.

The protocol provides `get_operations(base, head)` and
`operations(head, operations)` for missing history, but use version-aware recovery:
1.12.2's handler returns without a response when `base` is zero, whereas the
1.10.3 handler does not contain that guard. A resnapshot/reconnect fallback is
necessary. A second `doc` is not automatically an ordinary initial load:
1.10.3 operation exceptions send `force: true`; 1.12.2 waits for repeated
failures before forcing reset.

Sources: `lib/ot/server.js:18–43`,
`lib/ot/client.js:63–152,222–255`,
`lib/realtime.js:439–465,545–562`, and the two versions of
`lib/ot/editor-socketio-server.js` described above.

### Silent rejection, lost connection, and persistence

There are three distinct observations:

1. **Accepted live operation:** named `ack` received, with a reconciled OT state.
2. **Observed persisted content:** database-backed download reflects the
   reconciled content at a readback observation.
3. **Historical revision saved:** periodic saved-revision creation has run.

They are not interchangeable. OT ack marks the document dirty; a separate
one-second loop writes content and authorship to the database, then emits
`check`. Historical revision saving normally runs every five minutes. The last
socket disconnect can flush a dirty note, but that is asynchronous and is not a
client-visible transactional commit acknowledgement.

`check` contains updated metadata and author information, not the operation ID
or a durable revision number. A check event is useful evidence that a save
completed, but does not prove a specific edit was saved unchanged under
concurrency. A bounded HTTP readback of the reconciled live content is stronger;
still describe it as observed persistence, not an fsync guarantee.

No ack can mean:

- The server denied edit permission and silently returned.
- The resulting document grew beyond `documentMaxLength` and the OT server
  silently ignored it.
- An invalid revision/base/operation caused a replacement `doc` snapshot.
- The socket dropped after the server accepted the operation.

Thus a timeout is not proof of rejection. Validate known permission/length
conditions before submission, listen for `info`, `doc`, `permission`,
`maintenance`, `delete`, and disconnection, and return an explicit uncertain
outcome when acceptance cannot be established. Reconnect/resnapshot for
reconciliation, but never blindly replay an unknown-outcome edit: there is no
client-chosen idempotency key.

The reviewed older browser OT client can resend an outstanding operation on
reconnect. A headless tool should not treat that as a sufficient exactly-once
write contract. Socket.IO 4 connection-state recovery is also absent from
1.10.3 and is not a substitute for edit-outcome reconciliation.

Content NUL characters present an additional edge: the Note model strips
`\u0000` when persisting content. A live OT document could therefore differ
from its persisted representation. Reject unsupported NUL input or explicitly
document normalization; add that case to acceptance tests.

Sources: 1.10.3 `lib/ot/editor-socketio-server.js:43–65,105–118`,
`lib/ot/server.js:18–43`, `lib/realtime.js:79–174,199–209,551–570`,
and `lib/ot/client.js:148–151`;
1.12.2 `lib/realtime.js:80–177,201–210`,
`lib/models/note.js:64–70`, `lib/models/index.js:30–35`,
and `app.js:91–95`.

## Recommended MCP edit contract

Expose a service/note-oriented tool contract, not raw network requests or
unvalidated OT arrays. The exact schema remains a design choice for review.

For the first slice:

- `read_note(note)` returns Markdown plus an opaque snapshot fingerprint and
  whether content is persisted HTTP data or a current live snapshot.
- `edit_note(note, expected_snapshot, edits)` accepts exact-match replacements,
  each with `old_text`, `new_text`, and enough disambiguation to require one
  intended occurrence. Reject missing/ambiguous matches and overlapping edits.
- Compile a minimal edit into UTF-16 OT over a fresh live snapshot after checking
  the caller's fingerprint. Maintain connection generation, OT revision, base
  content, pending operation, and observed remote operations internally.
- Return the resulting content fingerprint, whether concurrent edits were
  incorporated, and an outcome such as `accepted`, `persisted-observed`,
  `rejected`, `stale-snapshot`, or `uncertain`. Do not conceal partial evidence
  behind an unconditional successful write result.

Whole-document replacement can be an explicit later tool, with the same
precondition and consequences explained. It should not be the default editing
mechanism: replacing the entire base loses semantic intent and can interact
surprisingly with concurrent insertions. Minimal exact text edits are easier
for users and models to review and reconcile.

**Important limit:** a preflight content hash detects that a note was already
changed, but it is not atomic compare-and-swap. Another editor can change the
document between the check and submission; the HedgeDoc OT server transforms
the operation instead of enforcing the client's fingerprint. The tool must
process and report that concurrency. If the desired guarantee is “abort on
every intervening remote edit,” stock reviewed APIs do not provide an atomic
server-side precondition; that would need a new server capability or a weaker
explicit guarantee. Never roll back to an old document automatically when
readback differs.

For a single user's process, keep each service's session isolated, serialize
writes per note, revalidate identity, and reject cross-origin note URLs or
redirects. Supporting the two example origins does not mean forwarding the
same session between them; each service requires its own HedgeDoc login.

## Small source experiments performed

An ephemeral Node script imported the upstream 1.12.2
`lib/ot/text-operation.js` directly, without starting HedgeDoc or sending network
operations. Independently specified cases passed:

| Base | Operation | Observed result |
| --- | --- | --- |
| `Hello` | `[5, " world"]` | `Hello world` |
| `Hello world` | `[6, "HedgeDoc", -5]` | `Hello HedgeDoc` |
| `😀` | `[2, "X"]` | `😀X` |
| Empty string | `["Hello"]` | `Hello` |
| `😀` | `[1, "X"]` | Rejected for incorrect base length |

For two concurrent operations over `Hello world`—replacement
`[6, "HedgeDoc", -5]` and insertion `[6, "new ", 5]`—the production transform
converged to **`Hello HedgeDocnew `** along both application paths. This
demonstrates structural convergence without guaranteeing the prose result a
human intended. It supports minimal edits, explicit concurrency reporting, and
real two-client acceptance cases.

These experiments verify the illustrative operation calculations only. They do
not establish a working network edit client, identity integration, durability,
or equivalence across every HedgeDoc release.

## Proposed implementation sequence and acceptance

| Stage | Proposed outcome to establish | Required evidence |
| --- | --- | --- |
| Session spike | A local process acts as the correct GitHub-backed HedgeDoc user | Explicit cookie import or browser-helper login; `/me` identity; expiration/logout/identity-change cases; credential redaction |
| 1.10.3 edit spike | A headless client edits a disposable controlled note | Engine.IO 3 + Socket.IO 2 handshake; `doc`/`refresh`; Unicode OT; named ack; forbidden writes; oversize write; persisted readback |
| Concurrency and recovery | Tool outcomes remain truthful with another editor present | Two clients changing overlapping and disjoint text; remote operation before ack; stale fingerprint; malformed op; reset snapshot; disconnect before/after acceptance; no blind replay |
| Newer-family target | Same tool contracts work on a selected 1.10.4+ deployment | Engine.IO 4/Socket.IO 4 backend; family-specific heartbeat/recovery; matching identity/content/error tests |
| MCP integration | Actual local MCP client can discover, read, and edit | Process transport/schema tests; origin isolation; protected session store; startup/cleanup; documentation and Book evidence |

The first authenticated network tests should use a disposable instance/note or
a note expressly selected by the user. Passive landing-page inspection supplied
no permission to modify an arbitrary production note.

## Decisions still needed

1. Must the first delivery support the supplied 1.10.3 services unchanged, or can
   their operators upgrade? The former requires legacy transport support.
2. Is a pinned Node/browser helper acceptable for the prototype or final
   distribution, or must every runtime component be Rust?
3. Should login initially be explicit session import, a controlled browser
   helper, or integration with an existing browser profile?
4. What does successful editing promise: live acceptance, observed persistence,
   or a stronger storage guarantee requiring an upstream API change?
5. Which text-edit contract should be exposed, and how should concurrent edits
   be presented to callers? Atomic stale-content rejection is not supplied by
   stock OT.
6. Will one process configure several origins, or run once per origin? Credentials
   and note identity must remain scoped either way.
7. Are creation, history discovery, and revision browsing part of the first
   slice, or follow-ups to the user-required reading/editing capability?

## Source index and reproducibility

Local references above name paths relative to `~/dev/hedgedoc` with one-based
source line numbers. For 1.10.3, inspect the exact file without changing checkouts:

```sh
git -C ../hedgedoc show d8b94026ee927213eda14973dd4386ea9e6389c0:lib/ot/editor-socketio-server.js
git -C ../hedgedoc show d8b94026ee927213eda14973dd4386ea9e6389c0:lib/realtime.js
git -C ../hedgedoc show 1.10.3:package.json
git -C ../hedgedoc show 1.10.4:package.json
```

Key pinned upstream sources:

- [1.10.3 package dependencies](https://github.com/hedgedoc/hedgedoc/blob/d8b94026ee927213eda14973dd4386ea9e6389c0/package.json)
- [1.10.3 realtime identity, permissions, and persistence](https://github.com/hedgedoc/hedgedoc/blob/d8b94026ee927213eda14973dd4386ea9e6389c0/lib/realtime.js)
- [1.10.3 OT event protocol](https://github.com/hedgedoc/hedgedoc/blob/d8b94026ee927213eda14973dd4386ea9e6389c0/lib/ot/editor-socketio-server.js)
- [1.10.3 GitHub authentication](https://github.com/hedgedoc/hedgedoc/blob/d8b94026ee927213eda14973dd4386ea9e6389c0/lib/web/auth/github/index.js)
- [1.10.3 HTTP/session and Socket.IO setup](https://github.com/hedgedoc/hedgedoc/blob/d8b94026ee927213eda14973dd4386ea9e6389c0/app.js)
- [1.12.2 note routes](https://github.com/hedgedoc/hedgedoc/blob/dbb71bae523af1dfba30006e4922143d8004f741/lib/web/note/router.js)
- [1.12.2 note controller](https://github.com/hedgedoc/hedgedoc/blob/dbb71bae523af1dfba30006e4922143d8004f741/lib/web/note/controller.js)
- [1.12.2 note resolution and creation](https://github.com/hedgedoc/hedgedoc/blob/dbb71bae523af1dfba30006e4922143d8004f741/lib/web/note/util.js)
- [1.12.2 note metadata and revisions](https://github.com/hedgedoc/hedgedoc/blob/dbb71bae523af1dfba30006e4922143d8004f741/lib/web/note/actions.js)
- [1.12.2 OT representation](https://github.com/hedgedoc/hedgedoc/blob/dbb71bae523af1dfba30006e4922143d8004f741/lib/ot/text-operation.js)
- [1.12.2 server-side transform/application](https://github.com/hedgedoc/hedgedoc/blob/dbb71bae523af1dfba30006e4922143d8004f741/lib/ot/server.js)
- [1.12.2 browser Socket.IO adapter](https://github.com/hedgedoc/hedgedoc/blob/dbb71bae523af1dfba30006e4922143d8004f741/public/vendor/ot/socketio-adapter.js)
- [1.12.2 history behavior](https://github.com/hedgedoc/hedgedoc/blob/dbb71bae523af1dfba30006e4922143d8004f741/lib/history.js)
- [1.12.2 API document](https://github.com/hedgedoc/hedgedoc/blob/dbb71bae523af1dfba30006e4922143d8004f741/docs/content/dev/api.md)

Primary external documentation retrieved on 2026-11-16:

- [HedgeDoc API documentation](https://docs.hedgedoc.org/dev/api/)
- [Socket.IO protocol and differences between revisions](https://socket.io/docs/v4/socket-io-protocol/)
- [Socket.IO client/server compatibility and connection troubleshooting](https://socket.io/docs/v4/troubleshooting-connection-issues/)
- [Socket.IO 2 client API, paths, and headers](https://socket.io/docs/v2/client-api/)
- [Socket.IO 4 client options](https://socket.io/docs/v4/client-options/)
- [Rust Socket.IO client primary README](https://github.com/1c3t3a/rust-socketio)
- [Rust client header and transport configuration](https://docs.rs/rust_socketio/latest/rust_socketio/client/struct.ClientBuilder.html)
- [Express session cookie defaults and rolling sessions](https://github.com/expressjs/session)
- [Playwright browser context cookie API](https://playwright.dev/docs/api/class-browsercontext#browser-context-cookies)

External library documentation is a current observation, not a pinned Hoglet
dependency selection. Pin and test any dependency chosen for implementation.
