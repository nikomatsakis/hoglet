# Session Access

Hoglet acts through a HedgeDoc session established for one configured service.
This chapter owns identity, note permissions, credential handling, and request
containment; the bridge owns content and write observations.

## Anchors

> **`A-service-respect-access`** (draft): **Service access controls govern every operation**
> Property: Hoglet uses only the configured anonymous or authenticated service session and honors HedgeDoc's separate read, edit, and creation policies. Denied access and login responses are failures, never Markdown or confirmed writes. A successful read or GitHub login does not establish edit permission. Credentials are absent from tool results and diagnostics.
> Authority: `R-service-access`; `R-github-session-access`
> - Criterion `permission-boundaries` [test]: Across the supported release matrix, exercise all six recognized permission modes with anonymous, owner, and other-user sessions; include GitHub-established identity, read-only access, disabled anonymous creation when creation is enabled, and login/forbidden response bodies. Assert actual user identity, no unauthorized confirmed write, and no credential values in results or diagnostics. An ambiguous silent rejection must remain unconfirmed rather than acquiring an invented reason.

> **`A-service-contained-requests`** (draft): **Note operations stay within the configured service**
> Property: Note inputs cannot change the configured request origin or escape its base path. HTTP requests, realtime handshakes, polling, and upgrades stay in that boundary. Service credentials are never forwarded to another origin, including through redirects; unsupported redirect flows stop with an explicit failure.
> Authority: `R-service-boundary`
> - Criterion `request-boundaries` [test]: Use controlled HTTP and realtime listeners to exercise encoded aliases, separators, traversal, full URLs, a deployment prefix, and same-origin and cross-origin redirects. Inspect initial requests, polling, upgrades, and credential updates; assert that no request escapes the configured base path and no credentials reach the second origin.

> **`A-service-verified-identity`** (draft): **Authenticated operations use the intended HedgeDoc user**
> Property: Browser-assisted GitHub login and development session import provision a credential only after HedgeDoc identifies the intended user; an anonymous cookie or GitHub token is insufficient. Each authenticated note call revalidates that identity. Observed expiry, logout, or identity change prevents new authenticated submissions and invalidates cached editing connections. HTTP and realtime requests use the same service-scoped session generation.
> Authority: `R-github-session-access`; `R-service-access`; `D-browser-session-login`
> - Criterion `identity-lifecycle` [test]: Exercise both browser-assisted GitHub login and development session import, an anonymous signed cookie, a valid wrong-user cookie, forbidden `/me` with HTTP 200, expiration, logout, rolling cookie updates, and identity switching. Inspect both HTTP and socket credentials and assert that a failed identity check closes old sockets and prevents new submissions. Test identity loss after submission as an outcome observation, without claiming the already submitted operation was undone.

> **`A-service-private-credentials`** (draft): **Login material stays outside the model's note interface**
> Property: Login and session import are local user actions, separate from MCP note tools. Only the configured HedgeDoc service credential is exported from a login helper, saved in Hoglet's session store, or passed to its bridge; GitHub credentials and unrelated browser state are excluded from those destinations. Session storage is restricted to the local user, and credentials never appear in tool schemas, results, command-line arguments, diagnostics, or published evidence.
> Authority: `R-service-access`; `R-github-session-access`; `R-local-mcp`; `D-browser-session-login`
> - Criterion `credential-flow` [test, review]: Review login, storage, IPC, logging, and MCP data flows. Use distinctive synthetic secrets to exercise provisioning, cookie renewal, HTTP/socket failures, redirects, shutdown, and reauthentication; inspect process arguments, retained files, tool traffic, and captured diagnostics, including encoded secret forms. Check restrictive file access or the selected user-scoped credential store. A browser helper must export no GitHub cookie or complete browser storage state.

## Service and identity

One process targets one explicitly configured service base URL. Separate service
instances use separate process configuration and session stores. Preserve the
deployment prefix when building `/me`, note, and `/socket.io/` paths. TLS
verification uses the client's normal verification; controlled test services
may use local HTTP.

The HedgeDoc instance owns GitHub login and its remote callback. Hoglet needs
the resulting HedgeDoc session, not a GitHub personal access token. Provisioning
records the user's chosen HedgeDoc user ID after a local identity check; the
process compares later `/me` responses with that identity. A response must have
the expected authenticated shape as well as an acceptable status.

HTTP and realtime share a scoped cookie jar. Preserve relevant cookie scope,
expiry, and Secure metadata, accept renewal only from the configured service,
and reconnect editing sockets when the identity or credential value changes.
Renewal of expiry for the same credential does not create a new identity
generation. An explicit anonymous mode supports reads permitted by the service;
this initial edit contract requires an authenticated intended user even for a
freely editable note.

Check identity before authenticated calls and again when assessing an edit
result. On a failed check, invalidate local authentication and close affected
sockets. If the write was already submitted, preserve its acceptance and
persistence observations and report the identity loss separately.
Session validation is not atomic with upstream editing: the reviewed server
retains handshake identity and can accept a write during a logout race. Hoglet
does not claim instantaneous revocation or cancellation of a committed edit.

## Provisioning boundary

`D-browser-session-login` makes browser-assisted login part of the first version
and keeps explicit import available for development. A local login action
returns identity and status, never the credential. Both methods satisfy the same
validation and isolation rules. Session import receives data through a private
input or protected file, rather than a command-line cookie value. The browser
helper uses a dedicated context for the service's normal GitHub login, exports
only the needed HedgeDoc credential, and closes its context after provisioning.
The local `login` command takes the intended HedgeDoc user ID, opens the
service's `/auth/github` flow, and times out after five minutes. The local
`import-session` command takes the same ID and reads one configured session
cookie from stdin or an owner-only file.

Store the minimal service credential in a user-scoped store or a file readable
only by the owner, with a protected parent directory. Do not retain the full
browser context's storage state. Renewal updates that scoped record; logout
removes local credentials and editing connections. Local logout does not claim
to revoke the upstream browser's session. Use a mode-700 parent and mode-600
JSON file keyed by the service fingerprint; reject symlink and permissive
session paths. Running processes check for removed or changed stored credentials
before authenticated calls. Changing the intended user requires restarting the
process; deleting the local session prevents the next authenticated submission.

MCP calls never launch an interactive browser or ask the model for a cookie.
Missing or invalid authentication returns `authentication-required` with a
nonsecret instruction to run the local login action.

## Note permission and request checks

Read, edit, and creation checks are distinct. Editing waits for both the live
document and permission metadata, checks known owner/permission/length
conditions, and leaves the upstream write check decisive. Permission changes
during a connection invalidate preflight assumptions. Missing acknowledgements
do not establish a specific permission failure.

Parse note selectors as data, encode path components, and validate the resulting
destination against the configured origin and prefix. Inspect redirects before
following them; a login page is never note content. Creation redirects identify
the note only when they satisfy the creation contract. The login helper's
deliberate navigation to GitHub is separate from authenticated note requests;
it never forwards the HedgeDoc cookie there.
