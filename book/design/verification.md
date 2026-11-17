# Verification

Verification assesses the declared anchor criteria at the protocol boundary,
HTTP and realtime boundaries, and actual supported HedgeDoc deployments. The
roadmap owns results and remaining gaps.

## Verification map

These layers complement one another; a unit or fixture result never establishes
an entire real-service criterion.

| Anchor | Criteria | Evidence boundary |
| --- | --- | --- |
| `A-mcp-usable-tools` | `protocol-session`, `tool-contracts` | Actual Node process, MCP client, published schemas, and recorded schema review |
| `A-mcp-bounded-calls` | `deadline-outcomes`, `process-lifecycle` | Actual process with stalled services, cancellation, and shutdown |
| `A-notes-faithful-content` | `markdown-roundtrip`, `snapshot-provenance` | Independently supplied HTTP content and live/persisted divergence |
| `A-notes-precise-edits` | `replacement-validation`, `unicode-operations` | Pure edit compiler, encoded operations, upstream oracle, and real socket |
| `A-notes-observable-edits` | `authenticated-edit`, `concurrent-edit`, `edit-outcomes` | MCP, two compatible editors, controlled protocol faults, and stored readback |
| `A-service-respect-access` | `permission-boundaries` | Recognized permission modes, distinct users, and upstream denial |
| `A-service-verified-identity` | `identity-lifecycle` | Provisioning, `/me`, shared HTTP/socket session, and invalidation |
| `A-service-private-credentials` | `credential-flow` | Local login/storage/IPC, captured outputs, synthetic secrets, and recorded flow review |
| `A-service-contained-requests` | `request-boundaries` | Controlled independent listeners observing HTTP and realtime destinations |
| `A-service-compatible-transports` | `release-matrix` | Exact release/settings matrix, protocol mismatch, and recorded compatibility review |
| `A-notes-truthful-creation` | `creation-outcomes` | Optional creation, redirect validation, and post-submission connection loss |

## Methods and scope

Each criterion requires tests. `tool-contracts`, `credential-flow`, and
`release-matrix` additionally require review: schemas, secret data flows, and
declared deployment support need assessment beyond successful samples.
Every listed method is required; tests do not substitute for those reviews.

No criterion requires formal proof. Network, permission, credential, and
persistence properties depend on unverified upstream services and deployment
settings; integration and fault tests assess those boundaries directly.
For the pure edit compiler, independently specified examples and generated
replacement/UTF-16 cases exercise exact preservation and invalid batches.
Assess the production OT integration against the upstream implementation as an
additional oracle, while retaining independent expected results. Formal proof
would need a precise production-code boundary and is not supplied merely by
reusing upstream OT. Reconsider methods if a later design warrants that scope.

Use independently specified HTTP and realtime fixtures for redirects,
malformed responses, containment, delayed/absent named ack, snapshot resets,
silent rejection, save failure, and disconnection after server application.
Control event ordering to exercise remote operations before ack and readback.
Assert destinations, headers, content, and operation counts as well as results.
Fixtures must not derive expectations from implementation output or merely
assert the same transform through a second copy of the same algorithm.

Protocol acceptance starts the actual Node executable, initializes a session, discovers
schemas, and invokes tools through the chosen MCP transport. A successful bridge
unit test does not establish protocol acceptance.

Realtime acceptance covers session identity, initial document state, edit
permissions, stale bases, concurrent operations, acknowledgements, reconnects,
and persistence observations. UTF-16-based operation offsets must be exercised
with non-BMP Unicode content when the upstream uses JavaScript string indexing.
Use a compatible second editing client to assess concurrency rather than
assuming a static HTTP fixture reproduces the collaborative protocol. Check
both disjoint and overlapping edits; convergence is not proof of human intent.
Snapshot, acknowledgement, persisted content, and historical revision are
separate observations.

Real-service acceptance uses disposable notes on a controlled HedgeDoc instance.
Record release, relevant service settings, identity mode, commands, code and Book
revisions, results, and limits. Synthetic tests and the reviewed 1.12.2 source
alone do not establish support for the entire 1.x series. Every declared release
must have its own executed matrix entry. A release used for source comparison
is not automatically an operational recommendation or supported deployment.

Login acceptance exercises both required paths: browser-assisted GitHub login
and development session import, with intended-user validation, expiration, and
identity change. Release acceptance includes both 1.10.3 and the explicitly
selected newer-family 1.x release. Use a dedicated GitHub-established
session for the real acceptance case; do not place real credentials in fixtures,
CI output, or evidence. Synthetic secrets test encoding, renewal, and error paths
independently. If interactive login is tested separately from automated CI,
record the command, result, environment, and reproducibility limits explicitly.

Deadline and lifecycle tests run against the actual process with controlled
hangs, canceled requests, and shutdown during pending writes. Local cleanup
cannot establish upstream rollback.

## Evidence and tooling

Associate each TypeScript test suite with its anchor/criterion identities
in `verification/criteria.json`, and record executed commands, results, revisions,
and coverage in the roadmap. The mapping must make missing tests and stale
references visible. It is not itself evidence that tests ran.

The pinned engine's native test-link scanner and runner are Rust-oriented; a
TypeScript comment does not make a suite discoverable or runnable by
`anchorbook verify`. Configure automated evidence only after a supported adapter
or runner exists and is tested. Explicit roadmap evidence and identifiable
review records are sufficient for the initial workflow.

Before Building, agree on unit, integration, real-service acceptance, mutation,
TypeScript type checking, formatting, linting, and CI commands, including
mutation scope and budget. The
delivery roadmap records that preparation separately from evidence for the
server. A passing Book check or build establishes documentation consistency,
not an implemented anchor.
