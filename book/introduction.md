# Introduction

Hoglet is a local MCP server that reads and edits notes on HedgeDoc 1.x services,
including deployments whose users sign in through GitHub. Its Book defines the
goal system, while code and verification evidence establish what exists today.

[Design](design/index.md) explains behavior and places verifiable properties
in anchors. [Authority](authority/index.md) records where those properties come
from: requirements and decisions. [Implementation Roadmaps](implementation-roadmaps/index.md)
organizes the work and records progress, evidence, and unresolved choices.

The engineer has specified local operation, reading and editing existing notes,
GitHub-authenticated HedgeDoc deployments, the use of Anchor Book, and
implementation in TypeScript on Node.js.
The selected first version uses stale-read checks followed by collaborative
merging, browser-assisted GitHub login with development session import, and
supports existing 1.10.3 deployments plus an explicitly tested newer release.
The precise tool contracts and transport are draft proposals for review. Record
acceptance, implementation, verification, and milestone completion are distinct
facts. The authoritative development phase is in `anchorbook.toml`.
