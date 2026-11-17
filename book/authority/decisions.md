# Decisions

The engineer has accepted TypeScript on Node.js, snapshot checks followed by
collaborative merging, browser-assisted GitHub login with development session
import, and support for both transport generations. Other choices remain draft
for review; acceptance does not establish implementation or verification.

> **`D-typescript-node`** (accepted): **Implement the server in TypeScript on Node.js**
> Choice: Hoglet's MCP server and HedgeDoc bridge run in one TypeScript application on Node.js.
> Requirements: `R-mcp-hedgedoc`; `R-local-mcp`; `R-edit-existing-notes`
> Rationale: The engineer selected TypeScript after reviewing Node, Python, and Rust. JavaScript Socket.IO clients and HedgeDoc's JavaScript OT logic make its existing editing protocol a direct integration target. The choice governs runtime, packaging, verification tooling, and contributor guidance.
> Alternatives:
> - Rust with a Node adapter adds a runtime boundary and two implementation languages.
> - Native Rust needs additional protocol and editing integration work.
> - Python is viable but requires a careful translation of OT and UTF-16 string behavior.
> Reconsider when: Native-binary distribution or another explicit environment requirement outweighs the chosen integration approach.

> **`D-stdio-first`** (draft): **Start with a stdio MCP transport**
> Choice: The initial server uses stdio for MCP, with diagnostics on stderr.
> Requirements: `R-mcp-hedgedoc`; `R-local-mcp`
> Rationale: A client can launch a local process with service configuration, giving the first prototype a bounded protocol and process boundary.
> Alternatives:
> - Streamable HTTP supports remote clients but introduces a network listener, client authentication, and service-session ownership to design.
> Reconsider when: The engineer requires remote MCP clients or a shared server deployment.

> **`D-http-note-access`** (draft): **Use HTTP for note reads, metadata, and creation**
> Choice: The bridge uses the documented HTTP endpoints for raw note reads, metadata, and optional creation. Existing-note editing has its own realtime contract rather than an assumed REST update endpoint.
> Requirements: `R-mcp-hedgedoc`; `R-note-content`; `R-write-outcomes`
> Rationale: The reference's note routes support these operations; its existing-note editing uses the collaborative realtime interface.
> Alternatives:
> - Using the realtime connection for reads keeps editing snapshots and reads on one live document, but adds session and transport complexity to simple downloads.
> - An instance-specific REST extension could supply note writes but would require service changes and separate compatibility guarantees.
> Reconsider when: Read consistency requires the live editing snapshot, or the supported upstream provides a stable authenticated write API.

> **`D-snapshot-checked-ot`** (accepted): **Check stale content before collaborative editing**
> Choice: Reject an edit whose expected content snapshot differs from the fresh live base before submission. After submission, reconcile HedgeDoc's operational transformations and report observed concurrent changes and resulting content. The tool does not promise atomic unchanged-content rejection or semantic preservation of overlapping remote edits.
> Requirements: `R-edit-existing-notes`; `R-github-session-access`
> Rationale: The engineer explicitly selected stale-read checks plus collaborative merging in response to the anchor-design question. This detects stale caller input while using stock HedgeDoc's collaborative protocol; the current API has no atomic content precondition.
> Alternatives:
> - A stricter atomic rejection contract requires an upstream capability or a different controlled editing arrangement; client-side checks alone cannot supply it.
> - Whole-document replacement obscures edit intent and interacts poorly with concurrent changes.
> Reconsider when: The engineer requires stricter conflict semantics or a supported upstream supplies conditional writes.

> **`D-browser-session-login`** (accepted): **Provide browser login and development session import**
> Choice: The first version provides browser-assisted login through the configured HedgeDoc service's GitHub flow, with explicit session import available for development. Both acquisition paths yield the intended user's HedgeDoc session and use the same identity-validation and credential-isolation rules.
> Requirements: `R-github-session-access`; `R-local-mcp`
> Rationale: The engineer explicitly selected browser-assisted GitHub login with session import for development in response to the anchor-design question. The shipped login experience must not depend on manually extracting a cookie; development import can isolate protocol testing from browser integration.
> Alternatives:
> - Shipping session import alone postpones the requested first-version login experience.
> - Reusing an existing browser profile needs a separate browser-access and distribution design.
> Reconsider when: Browser availability or supported deployment authentication changes require another user-approved provisioning method.

> **`D-dual-transport-targets`** (accepted): **Support current servers and a tested newer release**
> Choice: The first version supports HedgeDoc 1.10.3 and at least one explicitly selected and tested newer 1.x release using the Socket.IO 4 / Engine.IO 4 family. Both families expose the same note-tool and session contracts; supporting 1.10.3 does not require operators to upgrade.
> Requirements: `R-mcp-hedgedoc`; `R-edit-existing-notes`; `R-github-session-access`
> Rationale: The engineer explicitly selected support for the existing 1.10.3 deployments and a tested newer release in response to the anchor-design question. Matching transport clients address the protocol boundary; exact release and configuration acceptance still need executed evidence.
> Alternatives:
> - Requiring a 1.10.4-or-newer upgrade excludes the current deployment target.
> - Claiming every HedgeDoc 1.x release from a shared transport family exceeds the evidence of an explicit test matrix.
> Reconsider when: The engineer retires the older deployments or adds releases/configurations outside the tested matrix.
