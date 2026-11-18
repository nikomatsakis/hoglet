# Design

The design defines the intended server. Properties are anchors at the start of
their owning chapters; authority records explain why they must hold.

- [System Overview](system-overview.md) defines the MCP and CLI boundaries and
  their contracts. Its capability words are `mcp` and `cli`.
- [HedgeDoc Bridge](hedgedoc-bridge.md) defines note content, editing, HTTP and
  realtime behavior, and transport compatibility. Its capability words are
  `notes` and `service`.
- [Session Access](session-access.md) defines acting identity, permissions,
  credential handling, and the configured service boundary. Its capability
  word is `service`.
- [Verification](verification.md) defines how evidence assesses those properties.

Progress and open design questions belong in the delivery roadmap, not in these
goal definitions.
