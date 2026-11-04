---
title: MCP over HTTP stops a cancelled call
created: 2026-11-04
refs:
  - "[code://src/mcp/http.ts](../../src/mcp/http.ts) - one request for each POST, with no client sessions"
  - https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation - a receiver SHOULD stop a cancelled request
  - https://modelcontextprotocol.io/specification/2025-06-18/basic/transports - `Mcp-Session-Id`, which names a client's session over HTTP
---

`ahpc mcp --http` runs a cancelled call to its end, because it keeps no client sessions.
Two clients can use the same request id, so a cancellation matched by id alone could stop another client's call.
With an `Mcp-Session-Id` for each client, a cancellation can be matched by session and id.
Stdio cancellation is in [cli/20261104-1112-mcp-over-stdio-answers-at-the-same-time](../plans/cli/20261104-1112-mcp-over-stdio-answers-at-the-same-time/plan.md).
