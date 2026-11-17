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
stdio transport, one configured service per process, and `read_note`,
`get_note_info`, and snapshot-checked exact text edits. Use the draft design to
guide experiments; readiness does not accept every draft record or enter Building.
Changes to accepted login, concurrency, or compatibility guarantees require
renewed agreement.

Prepare runtime/dependency pins, schemas, finite limits, and an owner-restricted
session-file implementation first. Then establish MCP/HTTP behavior, isolate
the 1.10.3 editing protocol using development session import, exercise concurrency
and uncertain outcomes, add the selected newer target, and integrate browser
login. Every experimental result keeps its tested revision and coverage limits.

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

- **Anchor coverage:** `A-notes-faithful-content` · `markdown-roundtrip`, `snapshot-provenance` — Partial: selected read and snapshot observations; `A-notes-precise-edits` · `replacement-validation`, `unicode-operations` — Partial: selected edit compiler and socket examples; `A-service-respect-access` · `permission-boundaries` — Partial: GitHub identity and read/edit denial; `A-service-verified-identity` · `identity-lifecycle` — Partial: provisioning and invalidation spike; `A-service-private-credentials` · `credential-flow` — Partial: prototype secret-flow tests and review; `A-service-contained-requests` · `request-boundaries` — Partial: identifier and base-path behavior; `A-service-compatible-transports` · `release-matrix` — Partial: selected release observations, not completed compatibility acceptance; `A-notes-observable-edits` · `authenticated-edit`, `concurrent-edit`, `edit-outcomes` — Partial: prototype concurrency and write observations; `A-mcp-bounded-calls` · `deadline-outcomes`, `process-lifecycle` — Partial: selected timeout and cleanup cases.
- **Evidence:** Partial prototype passes; criterion remains Pending because
  real GitHub-established session acceptance and matrix cases remain.

### Accepted choices and remaining scope

TypeScript on Node.js is accepted. The anchor-design review proposes stdio,
one service per process, persisted HTTP reads with scoped snapshot tokens,
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

The engineer assigned milestone 2 with "please prototype". The runtime and
controlled prototype checks are implemented. No further product decision blocks
trying the executable. Real GitHub login needs the user's participation on an
interactive browser host; this headless workspace has Chromium for synthetic
testing. Milestone 2 remains In progress; milestone 3 remains Proposed.

### Evidence {#hoglet-delivery-2-evidence}

- Completion criteria: `protocol-session` Passed; `service-contracts` has partial
  passing observations and remains Pending.
- Revision: Uncommitted `master` working tree with no repository commit.
  Runtime, tests, dependency lockfile and Book are this prototype change.
  `target/prototype-evidence.json` records a source manifest and aggregate
  SHA-256 for the assessed files. Bootstrap and design evidence below retain
  their earlier scaffold baseline.
- Checks: `npm run typecheck`, `npm run build`, and
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
  the caller must re-read. No production service or private note was accessed.
- Supporting records: `verification/criteria.json`, `test/`, local CLI/setup
  instructions in `README.md`, `target/prototype-tests.log`,
  `target/acceptance-1.10.3.json`, and `target/acceptance-1.12.0.json`.
- Integration context: Local working tree only; no commit, push, merge or deployment.

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

Every advertised tool has matching input/output descriptions, a successful
protocol acceptance case, and invalid-input and upstream-error cases.

- **Anchor coverage:** `A-mcp-usable-tools` · `tool-contracts` — Full.
- **Evidence:** Pending.

#### Service guarantees hold {#hoglet-delivery-3-service-guarantees}

Recorded results satisfy the read, snapshot, precise edit, permission, identity,
credential, request-boundary, existing-note outcome, compatibility, and bounded
call criteria for the agreed supported releases and deployment settings.
Creation is outside this proposed slice; its anchor and the creation portions of
shared criteria remain deferred as recorded in the roadmap index.

- **Anchor coverage:** `A-notes-faithful-content` · `markdown-roundtrip` — Partial: read content; creation is deferred; `A-notes-faithful-content` · `snapshot-provenance` — Full; `A-notes-precise-edits` · `replacement-validation`, `unicode-operations` — Full; `A-service-respect-access` · `permission-boundaries` — Partial: read/edit permissions; creation is deferred; `A-service-verified-identity` · `identity-lifecycle` — Full; `A-service-private-credentials` · `credential-flow` — Full; `A-service-contained-requests` · `request-boundaries` — Full; `A-service-compatible-transports` · `release-matrix` — Full; `A-notes-observable-edits` · `authenticated-edit`, `concurrent-edit`, `edit-outcomes` — Full; `A-mcp-bounded-calls` · `deadline-outcomes`, `process-lifecycle` — Full.
- **Evidence:** Pending.

#### Contributor verification is reproducible {#hoglet-delivery-3-verification-workflow}

A fresh checkout can run the documented server and Book checks. Recorded mutation
results address surviving faults, and CI runs the agreed commands for the tested
revision. Instructions describe configuration, identity provisioning, supported
deployments, and known limits without including private credentials or notes.

- **Anchor coverage:** None — contributor tooling and release preparation.
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
