# Implementation Roadmaps

[Hoglet Delivery](delivery.md) establishes the Book workflow, records the assigned
API and GitHub-session investigation, and proposes a local read/edit prototype
followed by a verified server slice.
Each milestone owns its tasks, completion criteria, and evidence.

The methodology bootstrap, subagent API investigation, and TypeScript anchor
design are assigned work. Milestone 2 is assigned and In progress under
the accepted product choices; milestone 3 remains Proposed.
Existing-note editing and GitHub-authenticated service
access are required. TypeScript on Node.js, stale-read checks followed by
collaborative merging, browser-assisted GitHub login with development import,
and support for 1.10.3 plus a tested newer release are accepted.
The prototype selected precise schemas, runtime and dependency pins,
owner-only session files and HedgeDoc 1.12.0 as its newer acceptance target.
Controlled checks and basic real-service read/edit acceptance pass; GitHub
session acceptance and the full service matrix remain in milestone 2.

History and revision browsing, deletion, permissions, remote
MCP transport, resources, and prompts are deferred beyond the proposed first
slice. Each needs a design and milestone before implementation. This deferral
keeps those capabilities visible. Creation is also deferred from the proposed
read/edit slice: `A-notes-truthful-creation` · `creation-outcomes` and the creation
portions of `A-notes-faithful-content` · `markdown-roundtrip` and
`A-service-respect-access` · `permission-boundaries` remain defined, with no
creation implementation assigned. The first slice focuses on the required
existing-note capability; adding creation requires its own scoped milestone.
The retired draft decision identifier
`D-http-note-tools` is not reused: its read/create-only initial scope was replaced
by the required read/edit scope and the narrower `D-http-note-access` choice.
