---
title: A blocking MCP server start can be sent to the background
created: 2026-11-04
refs:
  - npm://@microsoft/agent-host-protocol@^1.0.0 - `McpServerStartingState.blocking` and `session/mcpServerBackgroundRequested`
  - file:///github/ahpd/.project/plans/host/47-p3-mcp-server-startup-can-be-backgrounded/plan.md - ahpd serves it, built
---

While an MCP server starts with `blocking` set, the host holds the next message until the server is up.
A client can ask the host to stop waiting with `session/mcpServerBackgroundRequested`.
ahpc does not show that a start blocks, and cannot send the request.
The idea: say which server the session waits on, with an action that sends it to the background.
