# Requirements

Accepted requirements come directly from the engineer's repository assignment
and clarification of the local read/edit use case. Draft requirements propose
additional guarantees for the note bridge and require review.

> **`R-mcp-hedgedoc`** (accepted): **Expose HedgeDoc 1.x services through MCP**
> Statement: Hoglet must be an MCP server for HedgeDoc 1.x services.
> Source: The engineer's instruction identifying this repository's product target and providing ~/dev/hedgedoc as the reference checkout.

> **`R-anchor-book`** (accepted): **Develop the repository using Anchor Book**
> Statement: The repository must use Anchor Book to maintain its goal design, governing requirements and decisions, verifiable anchors, implementation roadmaps, and agent working guidance.
> Source: The engineer's explicit instruction to adopt the anchor-book/anchor-book methodology, with ~/dev/anchor-book as the local source.

> **`R-local-mcp`** (accepted): **Run the MCP server locally**
> Statement: Hoglet must run locally for its user and connect to configured HedgeDoc services, including remotely hosted instances.
> Source: The engineer's request for reading and editing HedgeDocs from a local server, with hedgedoc.nikomatsakis.com and hedgedoc.symposium.dev as example service instances.

> **`R-edit-existing-notes`** (accepted): **Read and edit existing notes**
> Statement: MCP clients must be able to read existing HedgeDoc notes and edit their Markdown content; creation alone does not satisfy editing.
> Source: The engineer's explicit clarification that the MCP server should allow reading and editing HedgeDocs.

> **`R-github-session-access`** (accepted): **Use access established through HedgeDoc's GitHub login**
> Statement: Hoglet must support reading and editing on HedgeDoc deployments whose users authenticate through GitHub, operating with the intended user's HedgeDoc permissions.
> Source: The engineer's GitHub-login use case and example deployments.

> **`R-note-content`** (draft): **Preserve note content through the bridge**
> Statement: Clients must be able to retrieve raw Markdown and edit existing notes without Hoglet rendering or silently rewriting unrelated content. Optional creation must preserve submitted Markdown subject to documented upstream normalization.
> Source: Proposed initial note functionality; the HedgeDoc reference exposes raw download and Markdown import endpoints.

> **`R-service-access`** (draft): **Respect service permissions and protect credentials**
> Statement: Note operations must honor the configured service identity and HedgeDoc permissions, distinguish denied access from success, and keep service credentials out of tool results and diagnostics.
> Source: Proposed operating guarantee for accessing public and private notes using HedgeDoc's existing access controls.

> **`R-service-boundary`** (draft): **Confine operations to the configured instance**
> Statement: Client note references must not redirect requests outside the configured service origin or base path, and service credentials must never be forwarded to another origin.
> Source: Proposed guarantee for mapping caller-provided note references and upstream redirects into authenticated HTTP requests.

> **`R-write-outcomes`** (draft): **Make creation outcomes reliable to callers**
> Statement: Creation results must distinguish confirmed success, definite failure, and an uncertain committed write; Hoglet must not automatically duplicate creation after an uncertain outcome.
> Source: Proposed guarantee for writes over HTTP where a service may commit before a connection failure reaches the caller.

> **`R-bounded-operations`** (draft): **Give local callers bounded operation lifetimes**
> Statement: Hoglet must bound service waits and content sizes, clean up its local connections on cancellation or shutdown, and report possible writes truthfully when a deadline ends their observation.
> Source: Proposed operating guarantee for a local MCP process whose HTTP, realtime, and persistence waits can fail independently.
