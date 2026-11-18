# Hoglet Delivery

**Roadmap identifier:** `hoglet-delivery`

**Goal:** Deliver a local MCP server that reads and edits existing notes using
the intended user's GitHub-established HedgeDoc session on explicitly supported
1.x deployments, with the Book governing development and verification.

## Milestone 1. Establish the Anchor Book workflow {#hoglet-delivery-1}

**Outcome:** Contributors and agents can read the current contract, inspect the
goal design, and check and render the repository's Book with pinned tools.

**Status:** Complete

**Identifier:** `hoglet-delivery-1`

**Dependencies:** The engineer's methodology adoption assignment and the local
Anchor Book and HedgeDoc reference checkouts.

**Design basis:** `R-anchor-book` and [Working on Hoglet](../working-on-hoglet.md).

**Tasks**

- [x] Add the agent bootstrap, Book navigation, configuration, authoring references,
  initial authority, design anchors, and proposed delivery work.
- [x] Retrieve the pinned engine's working contract and review the HedgeDoc API
  and source boundaries used by the initial design.
- [x] Run the documented structural check and Book build, inspect rendered
  records and links, and record results and limits.

### Completion criteria

#### Reproducible Book workflow {#hoglet-delivery-1-book-workflow}

The pinned tools retrieve the contract, pass the configured structural check,
and build the full Book with validated records and roadmap links. Agent startup
guidance identifies the current contract, Book, phase, and commands.

- **Anchor coverage:** None — contributor setup, not a server property.
- **Evidence:** Passed; see the evidence record below.

### Evidence {#hoglet-delivery-1-evidence}

- Completion criterion: `book-workflow`.
- Revision: Initial uncommitted `master` working tree, with no repository commit;
  Book and configuration are this bootstrap change. `src/main.rs` remains the
  original scaffold, SHA-256
  `c8e0583694bb1e0188dbe28fe0d65ac1130723c55f968b6262b906c147f72549`.
- Check or observation: Retrieved the complete contract from the pinned engine;
  confirmed `anchorbook --version` reports
  `0.1.0 (9689b00416fd577bfb68a02f1fa310f6088404cf)`. Used the documented local
  clone installation and mdBook 0.5.4. Ran
  `target/tools/bin/anchorbook check --config anchorbook.toml`,
  `PATH="$PWD/target/tools/bin:$PATH" target/tools/bin/mdbook build`,
  `cargo fmt --check`, and `cargo check` with Rust 1.97.0.
- Result: Passed. Structural scope `structural/v1` reports zero errors. The
  preprocessor validates and renders all 11 chapters, 13 typed records, and
  three milestones with six completion criteria. HTML inspection confirms
  record authority links, required-method labels, and roadmap criterion
  fragments. Local-link inspection covers all 15 HTML pages with zero missing
  targets or fragments.
- Supporting record: Reproducible commands in
  [Working on Hoglet](../working-on-hoglet.md#supported-commands), rendered output
  at `target/anchorbook/`, and the authored startup guidance in `AGENTS.md`.
- Limitations: Checked on the existing local setup, not a fresh-machine
  installation; the remote Git installation alternative and external URL
  availability were not tested. Rendered HTML was inspected, without a browser
  visual review. No server behavior, deployment compatibility, CI, mutation
  results, or fresh-session agent trial is established.
- Integration context: Local working tree only; no commit, push, or merge.

The counts above describe the initial bootstrap baseline. Subsequent design
and source-investigation changes retain this setup outcome; subsequent
documentation checks are recorded under milestones 4 and 5.

### Completion record

Complete for the initial methodology bootstrap on 2026-11-16, with the evidence
and limits above. This completes the assigned Book setup, not a server anchor
or either proposed implementation milestone.

## Milestone 2. Resolve and exercise the first server slice {#hoglet-delivery-2}

**Outcome:** An assigned prototype establishes a usable MCP transport and the
HTTP, session, and realtime contracts needed for reading and editing notes.

**Status:** In progress

**Identifier:** `hoglet-delivery-2`

**Dependencies:** Completed milestones 1, 4, and 5 and the engineer's accepted
TypeScript, login, concurrency, and dual-transport choices. The project remains
in Prototyping: exact schemas, dependency pins, storage implementation, and the
newer-release/settings test target are preparation tasks within this milestone,
not prerequisites to starting them.

**Design basis:** [System Overview](../design/system-overview.md),
[HedgeDoc Bridge](../design/hedgedoc-bridge.md), `D-stdio-first`, and
`D-http-note-access`, `D-typescript-node`, `D-snapshot-checked-ot`,
`D-browser-session-login`, `D-dual-transport-targets`, `R-local-mcp`,
`R-edit-existing-notes`, `R-github-session-access`, and
[Session Access](../design/session-access.md).

### Prototype scope

The engineer assigned a local TypeScript/Node prototype using the proposed
stdio transport, service-scoped bridges, and `read_note`,
`get_note_info`, and snapshot-checked exact text edits. Use the draft design to
guide experiments; readiness does not accept every draft record or enter Building.
Changes to accepted login, concurrency, or compatibility guarantees require
renewed agreement.

Prepare runtime/dependency pins, schemas, finite limits, and an owner-restricted
session-file implementation first. Then establish MCP/HTTP behavior, isolate
the 1.10.3 editing protocol using development session import, exercise concurrency
and uncertain outcomes, add the selected newer target, and integrate browser
login. Every experimental result keeps its tested revision and coverage limits.

The engineer also assigned `hoglet auth` and `npm run auth` as convenient local
entry points, with automatic ID discovery after sign-in. This experiment keeps
the dedicated browser and minimal cookie export, adds optional expected-ID
validation, and preserves explicit-ID login and development import.
The assigned multiple-service extension adds a server argument to console
authentication, XDG data storage, persisted per-service profiles, local service
discovery, and service selection within one MCP process. It preserves independent
credentials, identities, snapshots and edit queues for each service.
The engineer's Keychain request extends this assignment with macOS-native
credential storage, nonsecret service discovery, safe migration from existing
files, and scoped cleanup. Protected-file storage remains available for other
platforms and explicit development use.
The engineer also assigned standalone installation with a private pinned Node.
This packaging experiment preserves native macOS login and Keychain, builds
without a system Node/npm, and verifies a relocated installed process.
The engineer's CLI extension exposes saved-service discovery, read, info and
snapshot-checked edit commands through shared application operations. It keeps
existing authentication/storage and tests actual commands, file/stdin input,
write outcomes and cancellation before updating the standalone installation.
The engineer also assigned help for a bare invocation and an explicit `mcp`
server command, retaining `serve` as an alias and checking both actual
protocol startup and the installed launcher.
The engineer assigned concise command help with a pointer to `hoglet skill`.
That local instruction command explains the LLM workflow, human authentication,
saved-session reuse, service selection, snapshot edits and write outcomes.
The engineer also assigned dedicated `auth --help` instructions for graphical
login and manual session import on a headless machine using Firefox or Chrome.

Controlled fixtures and disposable service instances can establish development
behavior before live user participation. Completing `service-contracts` still
requires the named real-service and GitHub-session observations; fixture passes
or session import alone cannot replace them. Interactive GitHub login needs
the user's participation and an interactive browser environment when that stage
is reached. No production deployment changes are part of this milestone.

**Tasks**

- [x] Finalize transport, supported MCP revision and TypeScript SDK, exact
  input/result schemas, selector grammar, limits, credential storage, and the
  exact newer-release/settings test target within the accepted product choices.
- [x] Replace the original Rust scaffold with the assigned TypeScript prototype;
  pin Node, package-manager, SDK, Socket.IO clients, and OT provenance, and
  establish reproducible application commands.
- [x] Exercise protocol initialization, discovery, and success/error handling
  with the actual prototype process.
- [x] Add the assigned auth entry points with automatic `/me` identity discovery,
  command-level checks, and synthetic browser success/failure cases.
- [x] Add per-service console authentication and XDG storage; exercise two saved
  services through one actual MCP process, including later provisioning,
  ambiguous/unsaved selections, isolated credentials and scoped logout.
- [x] Add native macOS Keychain storage and verify migration, secret-free
  metadata, renewal, per-service isolation, missing/denied access and logout.
- [x] Package an independent local installation with a private Node, an update
  workflow and installed-runtime browser/auth/MCP checks.
- [x] Expose note operations through the CLI and verify parsing, saved-service
  selection, exact/JSON output, edit outcomes, bounded input and cancellation.
- [x] Make bare invocation print help and add explicit `mcp` startup; verify
  actual process behavior and update installed usage.
- [x] Add concise help and local `skill` instructions; verify the workflow
  text, configuration-independent output and installed command.
- [x] Add dedicated auth help with Firefox/Chrome cookie and `/me` guidance,
  private-file import, verification and cleanup; check actual installed output.
- [ ] Exercise browser-assisted GitHub login and development session import;
  import and actual Chromium provisioning/export against synthetic login pass.
  The real GitHub interaction remains pending.
- [ ] Exercise HTTP reads and authenticated existing-note edits on controlled
  service fixtures and a real instance; reconcile findings with the design and
  governing records. Exercise identity invalidation, credential isolation,
  deadline/cancellation behavior, and process cleanup. Creation is deferred
  from this assigned read/edit slice. Controlled fixtures and basic real-service
  tests pass; remaining GitHub and service matrix gaps are recorded below.

### Completion criteria

#### Usable protocol session {#hoglet-delivery-2-protocol-session}

The prototype runs the actual transport through initialization, discovery, one
successful tool call, and invalid-input and service-error cases.

- **Anchor coverage:** `A-mcp-usable-tools` · `protocol-session` — Full.
- **Evidence:** Passed for the prototype; see the evidence record below.

#### Established service contracts {#hoglet-delivery-2-service-contracts}

Recorded prototype cases establish identifier handling, base-path behavior,
GitHub-session provisioning, HTTP response handling, content normalization,
permission denial, realtime edits, concurrent changes, and uncertain-write
semantics for the selected service releases. Updated
design and authority record what the first slice promises and which questions
remain. Cases must cover both 1.10.3 and the chosen newer-family release,
browser login and development import, and the accepted stale-check/merge policy.

- **Anchor coverage:** `A-notes-faithful-content` · `markdown-roundtrip`, `snapshot-provenance` — Partial: selected read and snapshot observations; `A-notes-precise-edits` · `replacement-validation`, `unicode-operations` — Partial: selected edit compiler and socket examples; `A-service-respect-access` · `permission-boundaries` — Partial: GitHub identity and read/edit denial; `A-service-verified-identity` · `identity-lifecycle` — Partial: provisioning and invalidation spike; `A-service-private-credentials` · `credential-flow`, `keychain-storage` — Partial: prototype secret-flow and native Keychain cases; independent review remains; `A-service-contained-requests` · `request-boundaries` — Partial: identifier and base-path behavior; `A-service-compatible-transports` · `release-matrix` — Partial: selected release observations, not completed compatibility acceptance; `A-notes-observable-edits` · `authenticated-edit`, `concurrent-edit`, `edit-outcomes` — Partial: prototype concurrency and write observations; `A-mcp-bounded-calls` · `deadline-outcomes`, `process-lifecycle` — Partial: selected timeout and cleanup cases.
- **Evidence:** Partial prototype passes; criterion remains Pending because
  real GitHub-established session acceptance and matrix cases remain.

#### Independent local runtime {#hoglet-delivery-2-standalone-install}

The assigned packaging experiment installs and launches without system
Node/npm and reuses browser authentication, Keychain and saved services outside
the checkout. Runtime verification, relocation and failed-install preservation
have executed evidence for the tested host.

- **Anchor coverage:** `A-mcp-independent-install` · `standalone-runtime` — Partial: host packaging experiment; other OS/architecture targets require their own checks.
- **Evidence:** Passed for the scoped macOS ARM64 prototype; see the packaging
  assessment below. Other targets remain untested.

#### CLI note operations {#hoglet-delivery-2-cli-operations}

Actual command processes expose the existing application operations with saved
credentials, service-bound snapshots, bounded input and truthful write
classifications. Controlled cases cover both transport families, failed
selection/validation and cancellation, including installed runtime use.

- **Anchor coverage:** `A-cli-note-operations` · `command-contracts`, `command-cancellation` — Partial: selected prototype command, fault and installed cases; exhaustive service matrix remains.
- **Evidence:** Passed for the scoped prototype; see the CLI assessment below.
  Default-help and explicit-`mcp` entry-point checks also pass.
  Concise-help and local skill instruction checks also pass.
  Dedicated auth-help instruction checks also pass.
  Real-service/GitHub and exhaustive fault matrices remain.

### Accepted choices and remaining scope

TypeScript on Node.js is accepted. The anchor-design review proposes stdio,
multiple locally provisioned services per process, persisted HTTP reads with scoped snapshot tokens,
exact text replacement batches, and read/edit plus metadata as the first tool
slice. Creation is deferred, with its unchanged property tracked separately.

The engineer explicitly selected all three recommended options:

1. Concurrency: reject a stale snapshot before submission, then reconcile and
   report collaborative merging during submission, recorded in
   `D-snapshot-checked-ot`.
2. Login: browser-assisted GitHub login in the first version with import for
   development, recorded in `D-browser-session-login`.
3. Compatibility: support the existing 1.10.3 deployments plus an explicitly
   selected and tested newer-family 1.x release, recorded in
   `D-dual-transport-targets`.

An initial import spike can isolate edit-protocol work, but browser-assisted
login and both transport targets are required delivery scope. Session import
alone or a newer-family-only client cannot complete the accepted first version.

The prototype selects MCP 2025-11-25 over stdio; explicit tool inputs and JSON
structured outcomes; one encoded note component; finite deadlines and 1 MiB
content limits; an owner-only session file; and 1.12.0 as the newer acceptance
target. Runtime/dependency pins are in contributor guidance and the npm lockfile.
Source investigation alone does not establish authenticated compatibility.

### Readiness

The engineer assigned milestone 2 with "please prototype" and assigned the auth
command with automatic identity discovery. The runtime and controlled prototype
checks are implemented. No further product decision blocks trying the executable.
Real GitHub login needs the user's participation on an interactive browser host.
Synthetic authentication passes with both headless Chromium and the commands'
normal visible browser. Milestone 2 remains In progress; milestone 3 remains Proposed.

### Evidence {#hoglet-delivery-2-evidence}

- Completion criteria: `protocol-session` Passed; `service-contracts` has partial
  passing observations and remains Pending; `standalone-install` and
  `cli-operations` Passed within their scoped prototype assessments.
- Revision: The original prototype assessment used an uncommitted `master`
  working tree before the initial repository commit.
  `target/prototype-evidence.json` records a source manifest and aggregate
  SHA-256 for the assessed files. Bootstrap and design evidence below retain
  their earlier scaffold baseline. The auth and multiple-service assessment uses a local working
  tree based on `49513f89d7fca6f3ea21733a34e991242ef0b37f`, with the auth code,
  tests, package commands and Book edits uncommitted.
- Original prototype checks: `npm run typecheck`, `npm run build`, and
  `HOGLET_BROWSER_TEST=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/hoglet-browsers npm test`.
  Forty-eight tests pass with no skips, including 500 generated Unicode
  examples in one test. Native Node tests launch the actual MCP process,
  initialize/discover/invoke all tools, reject bad arguments and unknown tools,
  exercise service failures, and inspect stdout for pure JSON-RPC and
  synthetic secret leakage. `npm run check:criteria` validates all 17 criterion
  associations; it is not an evidence runner.
- Controlled results: Both Socket.IO families pass selected Unicode, snapshot,
  permission, prefix/credential, concurrency and write-outcome cases.
  Missing named ack, callback-only response, reset and post-application
  disconnect return uncertain with one submission. Ack without save remains
  accepted. Before-submit remote changes and queued aliases reject stale
  content. Overlapping edits follow independently specified upstream OT
  expectations. Pending-write cancellation and SIGTERM close local resources
  without replay or rollback. HTTP stalls, realtime stalls, ack stalls,
  persistence stalls and oversized responses finish within tested deadlines.
  Identity loss preserves known ack; rolling expiry keeps the credential
  generation; local logout prevents the running process's next authenticated call.
- Browser/import results: The actual import CLI validates a synthetic user
  and writes a mode-600 record. Actual Chromium executes the login polling,
  identity and save code against a synthetic service in headless mode.
  Export retains only the configured service cookie, excluding synthetic
  GitHub and unrelated credentials. This is not an actual GitHub OAuth test.
- Auth checks: On Node 24.15.0 and npm 11.12.1, `npm run typecheck`,
  `npm test` (58 passed, four browser cases and one native Keychain case
  skipped), `npm run test:browser` (four passed), `npm run test:keychain`
  (three controlled cases and one native case passed), and
  `npm run check:criteria` (18 associations) pass.
  `node target/auth-cli-smoke.mjs` exercises the actual CLI and `npm run auth`
  with a positional server argument against a synthetic prefixed service,
  using normal visible Chromium; both discover the identity without an ID
  argument and save a mode-600 record under an isolated XDG data directory.
  HTTP/socket and browser checks require execution outside this host's sandbox.
- Packaging assessment: `HOGLET_NODE_ARCHIVE=<verified official archive>
  HOGLET_LEGACY_NODE=<actual Node 18.20.2> npm run test:standalone` passes on
  macOS ARM64. The actual shell installer builds with private Node 24.15.0/npm
  11.12.1 while system Node is 18.20.2 and system npm is unusable. A corrupt
  archive and a deliberately broken temporary source fail without replacing
  the current release. A completed update selects a new release and retains
  the old one; an unrelated command is preserved. The installation is moved,
  including paths with spaces, and run outside the checkout with host Node
  preload hooks set to invalid paths. Installed browser setup and visible
  synthetic auth save native Keychain credentials; one installed stdio process
  discovers both release fixtures, reads and edits through both Socket.IO
  clients, observes persisted content, and honors scoped logout. Temporary
  installation and Keychain entries are removed. `npm test` then passes 59
  cases with five optional cases skipped; type checking, 19 criterion
  associations, structural check, Book build and local-link inspection pass.
  The standalone installer also installs successfully at
  `~/.local/bin/hoglet`; an outside-checkout version check reports its private
  Node with Node 18 first on PATH. The default installation does not read,
  authenticate or migrate existing user services. macOS x64, Linux targets,
  a fresh machine, interrupted-installer recovery and real GitHub login remain
  untested. This is local prototype packaging, not a published release.
- CLI assessment: On 2026-11-18, the local working tree based on `49513f8`
  adds shared application operations and actual `services`, `read`, `info` and
  `edit` commands. `target/cli-evidence.json` records the assessed source
  manifest, SHA-256
  `967d7cc6f44e892b434838dea0e16ad74aa13da51f533d7e1e5df26b5ca56be6`.
  `npm test` passes 73 cases with five optional browser/native cases skipped;
  the 14 new actual-command cases exercise both release fixtures, exact
  raw/JSON Markdown, metadata, file/stdin replacements, stale/no-op/rejected
  edits, default/explicit/ambiguous/unsaved services, scoped snapshots,
  invalid/bounded input, failed identity, uncertain/accepted exit status and
  pre/post-submission cancellation. Assertions check zero invalid submissions,
  no replay, preserved acknowledgement and socket cleanup. Existing MCP
  regressions pass through the shared layer.
  `npm run typecheck` and all 21 criterion associations pass.
  `HOGLET_NODE_ARCHIVE=<verified official archive>
  HOGLET_LEGACY_NODE=<actual Node 18.20.2> npm run test:standalone` passes
  again on macOS ARM64, adding installed CLI discovery/read/info/edit through
  native Keychain and both transport fixtures, followed by MCP edits using
  the same credentials and scoped logout. The installed commands run outside
  the checkout with incompatible system Node and invalid host preload hooks.
  The default standalone installation is updated with these commands.
  Logs are `target/cli-tests.log` and `target/cli-standalone.log`.
  This establishes selected prototype command contracts, not full anchor
  coverage: actual GitHub, real-service CLI/permission acceptance, exhaustive
  signal/event-order faults and other host targets remain untested.
- CLI entry points: The subsequent local change on the same `49513f8` baseline
  makes a bare invocation print help before service configuration and adds
  `mcp [SERVER]`, retaining `serve` as an alias. `npm test` passes 75 cases
  with five optional cases skipped. Actual MCP tests run the new command
  through both release fixtures; the alias case checks positional service
  selection, protocol-only stdout, initialization, discovery and reads.
  Actual CLI tests compare bare/help/MCP-help output with invalid service
  settings and assert successful exit. Type checking, all 21 criterion
  associations and Book checks pass. The standalone installation is updated
  with `./install.sh --skip-browser` and its verified cached Node archive.
  `node target/mcp-entry-installed-smoke.mjs` runs the installed launcher outside
  the checkout with Node 18 first on PATH and invalid host preload hooks:
  bare help, both MCP commands, tool discovery, local service discovery and
  missing-auth error handling pass using an isolated XDG directory.
  Logs are `target/mcp-entry-tests.log` and `target/mcp-entry-install.log`.
  These are entry-point checks; browser, native Keychain and real-service
  acceptance were not repeated for this change.
- CLI workflow instructions: On the same local `49513f8` baseline, concise
  command help points to `hoglet skill`. That command prints Markdown covering
  human authentication, saved-session reuse, CLI versus MCP, service selection,
  read-before-edit snapshots, replacements and unconfirmed outcomes. Actual
  CLI tests exercise output with invalid service/storage configuration and
  reject unexpected skill arguments without echoing input. `npm test` passes
  77 cases with five optional browser/native cases skipped; type checking and
  all 21 criterion associations pass. `target/skill-evidence.json` records the
  tested source manifest. The standalone installation is updated using the
  verified cached runtime archive and `./install.sh --skip-browser`.
  `node target/skill-installed-smoke.mjs` checks installed help/skill and
  argument rejection, then MCP/serve initialization, discovery and missing-auth
  handling outside the checkout with isolated XDG data, Node 18 first on PATH
  and invalid host preload hooks. Logs are `target/skill-tests.log` and
  `target/skill-install.log`. Book structure, rendering and local links pass.
  These checks cover the instruction command and routing regressions; the
  full standalone browser/native-Keychain harness and real-service acceptance
  were not repeated for this change.
- Authentication help: The local `main` change based on `dbce25c` gives
  `auth --help`, `login --help` and `import-session --help` dedicated browser
  login and headless-machine instructions. These cover Firefox/Chrome cookie
  lookup, exact-value preservation, `/me` identity, private-file import,
  verification and cleanup; skill directs the user to these instructions.
  Actual-process tests check all three commands with invalid service/storage
  configuration, positional arguments and nonsecret fixed output. Global help
  stays concise. `npm test` passes 78 cases with five optional cases skipped;
  type checking, all 21 criterion associations and Book checks pass.
  The standalone installation is updated with the verified cached runtime
  archive. `node target/auth-help-installed-smoke.mjs` passes outside the
  checkout with Node 18 first on PATH, invalid host preload hooks and isolated
  XDG data, checking dedicated/global help, skill and MCP startup.
  Logs are `target/auth-help-tests.log` and `target/auth-help-install.log`.
  These checks verify help output and routing; interactive Firefox/Chrome
  cookie-copy steps, browser/native-Keychain acceptance and real-service
  acceptance were not repeated. The login/import implementation is unchanged.
- Auth results: Automatic `/me` discovery persists the authenticated identity.
  Explicit expected-ID login succeeds for a match and preserves the prior
  session on mismatch, including when `/me` renews the cookie. Forbidden
  HTTP 200 responses never provision an anonymous cookie; cancellation closes
  the helper, and storage failure exits promptly. Export excludes GitHub and
  unrelated cookies. Invalid CLI options fail without echoing supplied secrets.
  Package Volta settings select the existing runtime pins; no global defaults
  are changed.
- Runtime selection: The CLI validates Node before importing Playwright.
  A real Node 18.20.2 binary downloaded from nodejs.org and checked against its
  release SHA-256 returns `unsupported-runtime`, with the required Node range
  and an explicit Volta command; no browser is opened. The CLI regression
  test also covers the range boundaries and early rejection in a child process.
  Explicit `volta run --node 24.15.0 --npm 11.12.1 npm run auth SERVER -- --help`
  builds and launches the CLI successfully. The synthetic visible-browser
  command smoke is repeated after changing the import order. Existing terminals
  must select Volta's shims or invoke it explicitly; package pins alone do not
  replace a Node executable already selected by the shell.
- Multiple-service results: Separate console import processes register a 1.10.3
  fixture and a prefixed 1.12.0 fixture with different users, cookie values and
  cookie names. One actual MCP process discovers the second login after startup,
  selects both services, keeps HTTP/socket credentials isolated, and rejects
  an unsaved destination without contacting it. Identical content produces
  different service-scoped snapshots; another service's token submits nothing.
  Both services can have pending edits concurrently; SIGTERM closes both and
  retains uncertain classifications. A later process reuses the persisted
  profiles. Logout removes only its selected service and leaves the other usable.
  Private-file checks, legacy records, canonical hostname/URL equivalence,
  distinct prefix/scheme/port stores, and XDG fallback cases pass.
- Keychain results: macOS defaults to the User (login) Keychain using
  `@napi-rs/keyring` 2.1.2 and its pinned native binary. Actual CLI import
  processes save separate synthetic credentials; one MCP process discovers
  both through cookie-free metadata and reads using their distinct sessions.
  Native renewal removes the superseded entry; selected logout preserves the
  other service. Removing a Keychain item prevents the running MCP process's
  next network call. Native legacy migration preserves the cookie in Keychain
  and removes it from the metadata file. Both visible-browser auth entry points
  repeat successfully with Keychain storage. Temporary native entries are
  removed after tests; no existing user credentials were read or migrated.
  Controlled-adapter cases verify denial, mismatched readback and failed
  metadata publication preserve the original file and clean up newly staged
  secrets. Native calls use no credential-bearing subprocess arguments.
  Storage/adapter code was reviewed locally; independent review remains.
- Real-service results: `scripts/acceptance.mjs`, run through actual stdio MCP
  on disposable localhost instances, passes identity/import, raw
  Unicode/frontmatter, metadata, UTF-16 editing, named ack, database-backed
  readback and stale rejection following a compatible second editor's change.
  Direct HTTP creation is disposable-note setup, not a Hoglet tool.

| Target | Exact container image digest | Configuration and result |
| --- | --- | --- |
| HedgeDoc 1.10.3 | `sha256:eb01a5982efd4e01471d0f0102822c9bb79c89dae68e0930032a5df0d424b542` | ARM64, local HTTP, SQLite, email registration, anonymous access disabled, no prefix; basic MCP acceptance Passed |
| HedgeDoc 1.12.0 | `sha256:1df4cbc99611ccc9761fd46b08b91e4fc787e9adc5b3f190d1b897a29b825452` | Same settings and basic MCP acceptance Passed |

- Dependency/source assessment: `ot` 0.0.15's text operation is byte-identical
  to both target tags, SHA-256
  `5b757d243692272f446db55f59f5b256b67b1a5faf5f30093ae1ec2e24cba935`.
  Its MIT notice and source pins are in `THIRD_PARTY_NOTICES.md`.
  Legacy Engine.IO must use its Node WebSocket adapter on Node 24 to preserve
  cookie headers; this correction is covered by actual handshake inspection.
  Compatible debug/cookie overrides remove initial low-severity dependency
  findings. npm still reports four moderate entries from the legacy URI-parser
  chain; the parser sees only operator-configured origins, never note inputs.
  This does not constitute production dependency acceptance.
- Book checks: Structural check, mdBook rendering and local-link inspection
  pass. Phase remains Prototyping; no draft anchor is accepted by these results.
- Limitations: Real GitHub login, all six permission modes with every identity
  on both releases, actual prefixed deployments, full reconnect/event-order,
  credential-sink and malformed-input matrices, independent schema/secret-flow
  review, fresh-machine setup, mutation testing and CI remain. WebSocket-only
  operation requires deployment support. The MCP SDK suppresses responses to
  canceled requests; nonsecret stderr observations retain write classification.
  Reconnect/resnapshot observation after uncertainty is not implemented;
  the caller must re-read. The review also reproduced a pre-existing local
  logout race: an in-flight cookie renewal could recreate a removed session file.
  Saves now reject an observed removal or intervening update, but checking and
  publishing are still not atomic across processes; stop the MCP process before
  logout during trials. Actual locked-Keychain prompts and denial were not
  exercised; failure cases use a controlled adapter. Crashes between Keychain
  staging and metadata publication/old-entry deletion can leave an orphan
  entry; automatic crash cleanup is not implemented. No production service or private
  note was accessed by the auth assessment.
- Supporting records: `verification/criteria.json`, `test/`, local CLI/setup
  instructions in `README.md`, `target/prototype-tests.log`,
  `target/acceptance-1.10.3.json`, and `target/acceptance-1.12.0.json`.
  The local auth command smoke script is `target/auth-cli-smoke.mjs`.
- Integration context: The initial prototype is committed in `49513f8`.
  Auth, packaging and CLI workflow changes are published in `dbce25c` on
  `origin/main`. Dedicated auth-help additions are included in this source
  change; no service deployment.

### Completion record

Pending.

## Milestone 3. Deliver verified note tools {#hoglet-delivery-3}

**Outcome:** The local read/edit server implements its agreed tool contracts and
has protocol, fixture, and real-service evidence for the read/edit portions of
its governing anchors, with optional creation explicitly deferred.

**Status:** Proposed

**Identifier:** `hoglet-delivery-3`

**Dependencies:** Milestone 2; reviewed governing design and authority; agreed
compatibility matrix, test and mutation workflow, and contribution commands.
Entering Building requires the engineer's phase decision and accepted records.

**Design basis:** [System Overview](../design/system-overview.md),
[HedgeDoc Bridge](../design/hedgedoc-bridge.md),
[Session Access](../design/session-access.md), and
[Verification](../design/verification.md).

**Tasks**

- [ ] Implement the agreed tools, configuration, bridge, and failure semantics.
- [ ] Add criterion-linked tests, protocol acceptance, HTTP and realtime
  fixtures, concurrent editing tests, and real-service tests for the agreed
  releases, GitHub-established identities, and instance settings.
- [ ] Establish TypeScript type checking, formatting, linting, mutation, CI,
  and criterion-mapped evidence commands; wire
  Book checks into the agreed contributor workflow.
- [ ] Record anchor results, schema review, tested revisions, supported
  deployments, and operational instructions.

### Completion criteria

#### Advertised tools match their contracts {#hoglet-delivery-3-tool-contracts}

Every advertised tool and CLI note command has matching input/output
descriptions, a successful acceptance case, and invalid-input and upstream-error
cases. CLI cancellation and exit statuses preserve the same write observations.

- **Anchor coverage:** `A-mcp-usable-tools` · `tool-contracts` — Full; `A-cli-note-operations` · `command-contracts`, `command-cancellation` — Full.
- **Evidence:** Pending.

#### Service guarantees hold {#hoglet-delivery-3-service-guarantees}

Recorded results satisfy the read, snapshot, precise edit, permission, identity,
credential, request-boundary, existing-note outcome, compatibility, and bounded
call criteria for the agreed supported releases and deployment settings.
Creation is outside this proposed slice; its anchor and the creation portions of
shared criteria remain deferred as recorded in the roadmap index.

- **Anchor coverage:** `A-notes-faithful-content` · `markdown-roundtrip` — Partial: read content; creation is deferred; `A-notes-faithful-content` · `snapshot-provenance` — Full; `A-notes-precise-edits` · `replacement-validation`, `unicode-operations` — Full; `A-service-respect-access` · `permission-boundaries` — Partial: read/edit permissions; creation is deferred; `A-service-verified-identity` · `identity-lifecycle` — Full; `A-service-private-credentials` · `credential-flow`, `keychain-storage` — Full; `A-service-contained-requests` · `request-boundaries` — Full; `A-service-compatible-transports` · `release-matrix` — Full; `A-notes-observable-edits` · `authenticated-edit`, `concurrent-edit`, `edit-outcomes` — Full; `A-mcp-bounded-calls` · `deadline-outcomes`, `process-lifecycle` — Full.
- **Evidence:** Pending.

#### Contributor verification is reproducible {#hoglet-delivery-3-verification-workflow}

A fresh checkout can run the documented server and Book checks. A standalone
installation runs with its private runtime on every declared target, without
system Node/npm or a source checkout, using the documented auth and MCP workflows.
Recorded mutation
results address surviving faults, and CI runs the agreed commands for the tested
revision. Instructions describe configuration, identity provisioning, supported
deployments, and known limits without including private credentials or notes.

- **Anchor coverage:** `A-mcp-independent-install` · `standalone-runtime` — Full; other contributor checks prepare the release.
- **Evidence:** Pending.

### Completion record

Pending.

## Milestone 4. Investigate GitHub-authenticated reading and editing {#hoglet-delivery-4}

**Outcome:** A source-backed report explains the HTTP, session, realtime editing,
version, and persistence boundaries for the engineer's local MCP use case and
identifies a concrete prototype approach and its limits.

**Status:** Complete

**Identifier:** `hoglet-delivery-4`

**Dependencies:** Milestone 1; the engineer's explicit subagent deep-dive
assignment and example deployments.

**Design basis:** `R-local-mcp`, `R-edit-existing-notes`,
`R-github-session-access`, [System Overview](../design/system-overview.md),
and [HedgeDoc Bridge](../design/hedgedoc-bridge.md).

**Tasks**

- [x] Assign a subagent to review the HTTP APIs, GitHub authentication, signed
  sessions, realtime edit protocol, concurrency, persistence, and release
  compatibility.
- [x] Reconcile the engineer's local read/edit goal with requirements, design,
  anchors, and affected server milestones.
- [x] Review `research/hedgedoc-v1-api-deep-dive.md`, verify its central claims
  against sources, and record its recommendations and unresolved questions.
- [x] Run structural, Book-build, and affected-link checks.

### Completion criteria

#### Source-backed API and session investigation {#hoglet-delivery-4-api-investigation}

The report identifies concrete HTTP and realtime interfaces, the GitHub/session
credential boundary, release-specific transport requirements, edit operation
and acknowledgement semantics, concurrency and persistence limits, and a
recommended prototype with explicit unanswered questions. Claims cite exact
source revisions and locations. Any live observations use passive public
requests and contain no session values or private note content.

- **Anchor coverage:** None — design preparation and source evidence, not executed server verification.
- **Evidence:** Passed; see the source-investigation record below.

### Evidence {#hoglet-delivery-4-evidence}

- Completion criterion: `api-investigation`.
- Revision: Uncommitted `master` working tree; no repository commit.
  Report SHA-256:
  `6ce42423de5a59f75fd41dcb258d77a66d4c420f4eac9142602d86054ea2cf8c`.
  Source baselines are HedgeDoc 1.10.3 at
  `d8b94026ee927213eda14973dd4386ea9e6389c0` and the 1.12.2 checkout at
  `dbb71bae523af1dfba30006e4922143d8004f741`.
- Check or observation: Subagent report reviewed in full; central GitHub session,
  note permission, noteId handshake, OT acknowledgement, persistence, and
  release-family claims independently checked against primary source. The
  report references 23 source files and includes exact operation examples,
  local source calculations, authentication alternatives, and proposed
  acceptance cases. Current structural check and Book build run with the
  pinned tools; rendered local links and source README links inspected.
- Result: Passed for the source-investigation outcome and documentation
  consistency. Passive landing-page GETs on both supplied examples report
  HedgeDoc 1.10.3 and a GitHub login link. Stock 1.10.3 uses Socket.IO 2 / Engine.IO
  3; 1.10.4 changes to Socket.IO 4 / Engine.IO 4. GitHub login yields a HedgeDoc
  session; the reviewed editing protocol requires that session and uses named
  acknowledgements distinct from database persistence.
- Supporting record: `research/hedgedoc-v1-api-deep-dive.md`, with pinned source
  references, passive observations, protocol examples, source-experiment
  results, and explicit proposed implementation stages.
- Limitations: Deployment headers do not prove installed source or transport
  configuration. No authenticated login, private-note read, network edit,
  durable-save acceptance, or working Rust/Node transport was tested. Browser
  session export and a legacy-compatible helper are recommendations. Snapshot
  checks cannot establish atomic compare-and-swap against concurrent edits.
  This evidence does not satisfy any server anchor.
- Integration context: Local working tree only; no commit, push, or merge.

### Completion record

Complete on 2026-11-16 for the assigned subagent source investigation and Book
reconciliation. Milestone 2 is the next prototype; milestone 3 remains Proposed.
Milestone 5 incorporates
the engineer's subsequent TypeScript, login, concurrency, and dual-transport
choices; this source investigation remains preparation rather than runtime evidence.

## Milestone 5. Design the TypeScript server anchors {#hoglet-delivery-5}

**Outcome:** A reviewable TypeScript/Node goal design gives each proposed
guarantee precise authority and verification criteria, with implementation work,
deferred capabilities, accepted product choices, and remaining prototype details
made explicit.

**Status:** Complete

**Identifier:** `hoglet-delivery-5`

**Dependencies:** Milestones 1 and 4; the engineer's explicit TypeScript
selection, request to design anchors and surface decision questions, and explicit
answers selecting concurrency, login, and compatibility policies.

**Design basis:** `D-typescript-node`,
[System Overview](../design/system-overview.md),
[HedgeDoc Bridge](../design/hedgedoc-bridge.md),
[Session Access](../design/session-access.md), and
[Verification](../design/verification.md).

**Tasks**

- [x] Incorporate the accepted TypeScript direction and reconcile contributor
  guidance without claiming a runtime migration.
- [x] Preserve existing anchor identities, specify snapshot/edit/outcome cases,
  and add identity, credential, compatibility, precise-edit, and lifecycle
  guarantees with justified verification methods.
- [x] Map every criterion to proposed work or an explicit deferral, and surface
  login, concurrency, and release decisions.
- [x] Incorporate the engineer's three selected policies into accepted
  decisions, affected anchor scope, verification, and implementation work.
- [x] Check structure, build the Book, inspect records and links, and record
  design-check results and limitations.

### Completion criteria

#### Reviewable anchors and reconciled work {#hoglet-delivery-5-anchor-design}

The design has one canonical definition per anchor, valid authority and method
declarations, concrete behavior and failure criteria, and planned work or an
explicit deferral for every criterion. TypeScript and the engineer's selected
concurrency, login, and compatibility policies are incorporated; remaining
prototype choices remain explicit. Structural, rendering, and
affected-link checks pass.

- **Anchor coverage:** None — design preparation, not executed server verification.
- **Evidence:** Passed; see the design-check record below.

### Evidence {#hoglet-delivery-5-evidence}

- Completion criterion: `anchor-design`.
- Revision: Uncommitted `master` working tree, with no repository commit.
  At this historical design baseline, TypeScript was recorded in authority
  and guidance while the Rust scaffold and source research report remained unchanged.
  Design inputs were the
  source investigation recorded by milestone 4 and the engineer's TypeScript
  selection, anchor-design assignment, and explicit answers to the three
  product-choice questions.
- Check or observation: Retrieved the pinned working contract and read the
  current Book and authoring references. Compared prior record identities with
  the revised inventory; reviewed property/authority meaning, snapshot scope,
  Unicode indexing, silent rejection, concurrent OT, session invalidation,
  credential flows, and no-replay outcomes. Ran the documented structural check
  and mdBook build; inspected rendered records, methods, authority links,
  roadmap coverage, and local HTML links. Checked that each criterion has
  proposed work or an explicit deferral. Rechecked accepted-decision authority
  and strengthened login and compatibility scope after the engineer's answers.
- Result: Passed for design preparation and documentation consistency.
  Structural scope `structural/v1` reports zero errors. The Book contains
  12 chapters, 27 typed records including 11 draft anchors and 17 anchor
  criteria, and five milestones with eight completion criteria. All 17 prior
  record identities are retained. Local-link inspection covers 16 HTML pages
  with no missing page or fragment. TypeScript evidence integration is
  explicitly proposed rather than attributed to the engine's Rust test runner.
- Supporting record: Design and authority chapters, the verification map, this
  roadmap's proposed coverage, and the creation deferral in its index.
  Rendered output is `target/anchorbook/`; the current readiness report is
  `target/readiness-report.md`.
- Limitations: The engineer has accepted the three product policies; this does
  not accept every draft anchor or establish behavioral evidence. Exact newer
  release/settings, dependencies, serialization, and tooling remain to be
  resolved within the prototype's scope at that baseline. No
  TypeScript runtime, network login/edit, compatibility acceptance, server
  tests, formal proof, mutation run, or CI is established. Rendered HTML and
  links were inspected without a browser visual review. Current runtime
  implementation and evidence are recorded under milestone 2.
- Integration context: Local working tree only; no commit, push, or merge.

### Completion record

Complete on 2026-11-16 for the assigned anchor design and Book reconciliation.
The selected concurrency, login, and dual-transport policies are incorporated.
Milestone 2 is now assigned and In progress; milestone 3 remains Proposed.
This design completion does not verify anchors; milestone 2 owns runtime evidence.
