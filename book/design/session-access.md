# Session Access

Hoglet acts through separate HedgeDoc sessions established for saved services.
This chapter owns identity, note permissions, credential handling, and request
containment; the bridge owns content and write observations.

## Anchors

> **`A-service-respect-access`** (draft): **Service access controls govern every operation**
> Property: Hoglet uses only the configured anonymous or authenticated service session and honors HedgeDoc's separate read, edit, and creation policies. Denied access and login responses are failures, never Markdown or confirmed writes. A successful read or GitHub login does not establish edit permission. Credentials are absent from tool results and diagnostics.
> Authority: `R-service-access`; `R-github-session-access`
> - Criterion `permission-boundaries` [test]: Across the supported release matrix, exercise all six recognized permission modes with anonymous, owner, and other-user sessions; include GitHub-established identity, read-only access, disabled anonymous creation when creation is enabled, and login/forbidden response bodies. Assert actual user identity, no unauthorized confirmed write, and no credential values in results or diagnostics. An ambiguous silent rejection must remain unconfirmed rather than acquiring an invented reason.

> **`A-service-contained-requests`** (draft): **Note operations stay within the configured service**
> Property: Note inputs cannot change the configured request origin or escape its base path. HTTP requests, realtime handshakes, polling, and upgrades stay in that boundary. Service credentials are never forwarded to another origin, including through redirects; unsupported redirect flows stop with an explicit failure.
> Authority: `R-service-boundary`; `R-multiple-services`
> - Criterion `request-boundaries` [test]: Use controlled HTTP and realtime listeners to exercise encoded aliases, separators, traversal, full URLs, a deployment prefix, and same-origin and cross-origin redirects. Provision two services with distinct cookies and identities, select both through one MCP process, and reject unsaved service selections before network access. Inspect initial requests, polling, upgrades, and credential updates; assert that no request escapes the selected service's base path and no credential reaches another service.

> **`A-service-verified-identity`** (draft): **Authenticated operations use the intended HedgeDoc user**
> Property: Browser-assisted GitHub login and development session import provision a credential only after HedgeDoc identifies the intended user; an anonymous cookie or GitHub token is insufficient. Each service retains its own pinned identity and credential generation, and each authenticated note call revalidates that identity. Observed expiry, logout, or identity change prevents new authenticated submissions and invalidates cached editing connections for that service. HTTP and realtime requests use the same service-scoped session generation.
> Authority: `R-github-session-access`; `R-service-access`; `R-multiple-services`; `D-browser-session-login`
> - Criterion `identity-lifecycle` [test]: Exercise automatic identity discovery through the local auth command, optional expected-user validation, browser-assisted GitHub login and development session import, an anonymous signed cookie, a valid wrong-user cookie, forbidden `/me` with HTTP 200, expiration, logout, rolling cookie updates, and identity switching. With two saved services, verify that provisioning and logout affect only the selected service and that a later MCP process loads their distinct identities. Inspect both HTTP and socket credentials and assert that a failed identity check closes old sockets and prevents new submissions. Test identity loss after submission as an outcome observation, without claiming the already submitted operation was undone.

> **`A-service-private-credentials`** (draft): **Login material stays outside the model's note interface**
> Property: Login and session import are local user actions, separate from MCP note tools. Only the configured HedgeDoc service credential is exported from a login helper, saved in Hoglet's session store, or passed to its bridge; GitHub credentials and unrelated browser state are excluded from those destinations. Session storage is restricted to the local user, and credentials never appear in tool schemas, results, command-line arguments, diagnostics, or published evidence.
> Authority: `R-service-access`; `R-github-session-access`; `R-local-mcp`; `R-macos-keychain`; `D-browser-session-login`
> - Criterion `credential-flow` [test, review]: Review login, storage, IPC, logging, and MCP data flows. Use distinctive synthetic secrets to exercise provisioning, cookie renewal, HTTP/socket failures, redirects, shutdown, and reauthentication; inspect process arguments, retained files, tool traffic, and captured diagnostics, including encoded secret forms. Check restrictive file access or the selected user-scoped credential store. A browser helper must export no GitHub cookie or complete browser storage state.
> - Criterion `keychain-storage` [test, review]: On macOS, provision and reopen a session using native Keychain access; inspect metadata files and process arguments for credential absence. Exercise two services, renewal, missing credentials, scoped logout, and protected-file migration. Verify Keychain readback before replacing a legacy file; failed writes or mismatched readback leave the original intact. Keychain denial never falls back to a plaintext file.

## Service and identity

One MCP process selects among locally provisioned services. Each service uses
separate bridge configuration and session storage. Local authentication registers
the origin and deployment prefix; a note caller cannot register a destination.
Preserve the
deployment prefix when building `/me`, note, and `/socket.io/` paths. TLS
verification uses the client's normal verification; controlled test services
may use local HTTP.

The HedgeDoc instance owns GitHub login and its remote callback. Hoglet needs
the resulting HedgeDoc session, not a GitHub personal access token. Provisioning
records the HedgeDoc user ID discovered after the user signs in through the
local browser workflow; the process compares later `/me` responses with that
identity. An optional expected ID must match before provisioning. A response
must have the expected authenticated shape as well as an acceptable status.

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
The local `hoglet auth` command opens the service's `/auth/github` flow and
discovers the signed-in user's ID through `/me`, without requiring the user to
copy an ID. It prints the verified identity after saving and times out after
five minutes. `npm run auth` builds and runs this command from a local checkout.
`hoglet auth SERVER` and `npm run auth SERVER` select a hostname or full HTTP(S)
base URL. Bare hostnames use HTTPS. The argument takes precedence over
`HOGLET_SERVICE`; without an argument, that environment setting is required for
authentication. Import and logout accept the same service selection.
An optional `--user-id ID` requires that specific identity; the existing
`login --user-id ID` command retains the same explicit check. The local
`import-session --user-id ID` command requires the intended ID and reads one
configured session cookie from stdin or an owner-only file.
`hoglet auth --help` explains both browser provisioning and manual import on a
headless machine. Its Firefox/Chrome instructions use an existing signed-in
browser elsewhere to retrieve `/me` identity and the exact HedgeDoc cookie,
then a private file on the target machine for import and cleanup. This reuses
an existing session; it does not implement fresh terminal-only GitHub login or
automated transfer. Help exits without accessing service configuration or credentials.

Store the minimal service credential in a user-scoped store or a file readable
only by the owner, with a protected parent directory. Do not retain the full
browser context's storage state. Renewal updates that scoped record; logout
removes local credentials and editing connections. Local logout does not claim
to revoke the upstream browser's session. On macOS, default to the user's
login Keychain through the pinned native adapter, with no credential-bearing
subprocess arguments. Store only service identity, release, cookie name and an
opaque credential reference in a schema-2 JSON record. Use a new Keychain entry
for each saved generation, verify its content, atomically publish the metadata,
then delete the superseded entry. Failure must not fall back to plaintext.
Loading a legacy file migrates it after verified Keychain storage; failure
preserves the original file. Discovery reads metadata without requesting a
Keychain secret. Logout removes the selected Keychain entry and metadata.

Other platforms retain protected-file storage; `HOGLET_CREDENTIAL_STORE=file`
explicitly selects it for new sessions and development. Already referenced
Keychain credentials remain in Keychain. Use a mode-700 parent and mode-600
JSON file keyed by the service fingerprint; reject symlink and permissive
paths for both metadata and legacy sessions. Store these files at
`$XDG_DATA_HOME/hoglet/<service-fingerprint>/session.json`, defaulting to
`~/.local/share/hoglet/` when the variable is empty or not an absolute path.
Canonical URLs distinguish scheme, host, port and deployment prefix, while
equivalent trailing-slash and hostname spellings share a store. Persist each
service's release and cookie-name profile beside its credential; legacy records
without these fields use the configured profile, defaulting to 1.10.3 and
`connect.sid`. A custom `HOGLET_SESSION_FILE` applies only to an explicit default
service. Running processes check for removed or changed stored credentials
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
