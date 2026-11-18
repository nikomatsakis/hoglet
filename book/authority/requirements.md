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

> **`R-multiple-services`** (accepted): **Use multiple services from one local MCP process**
> Statement: A user can authenticate to multiple HedgeDoc services from a console, persist each service's credentials in user-scoped storage and its settings in XDG-style user directories, and use those sessions later through one MCP process, selecting the service for each note operation. `R-macos-keychain` governs credential storage on macOS.
> Source: The engineer's request for `npm run auth hedgedoc.nikomatsakis.com`, persistent per-service console login, and explicit selection of one MCP process for all services.

> **`R-macos-keychain`** (accepted): **Keep macOS session credentials in Keychain**
> Statement: On macOS, Hoglet stores saved service credentials in the user's Keychain. Nonsecret service settings remain discoverable independently in the user's XDG directory. Existing protected-file credentials can migrate without requiring another login; Keychain failure must not silently create a plaintext copy.
> Source: The engineer's request to store credentials in the Mac system Keychain after reviewing the existing session-file workflow.

> **`R-private-node-runtime`** (accepted): **Run installed Hoglet with its own Node**
> Statement: A local Hoglet installation includes its own pinned Node runtime and application dependencies. Authentication and MCP operation do not depend on the shell's Node/npm versions or the source checkout. macOS browser login and Keychain storage remain available.
> Source: The engineer accepted a standalone local package and clarified that isolation from npm issues requires Hoglet's own copy of Node, rather than a container.

> **`R-edit-existing-notes`** (accepted): **Read and edit existing notes**
> Statement: MCP clients must be able to read existing HedgeDoc notes and edit their Markdown content; creation alone does not satisfy editing.
> Source: The engineer's explicit clarification that the MCP server should allow reading and editing HedgeDocs.

> **`R-cli-note-operations`** (accepted): **Expose note operations through the CLI**
> Statement: Hoglet's existing service discovery, note reads, metadata and snapshot-checked edits are also available as local CLI commands. They reuse saved services and credentials and preserve the MCP operations' access checks and write-outcome semantics. Invoking `hoglet` without arguments prints concise command help; `hoglet mcp` explicitly starts the MCP server. Help directs callers to `hoglet skill` for LLM workflow instructions, including when the user must authenticate and how saved sessions are reused.
> Source: The engineer's request to extend Hoglet so its functionality is available as a CLI, followed by the requests for default help, an explicit `mcp` command and separate workflow instructions through `hoglet skill`.

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
