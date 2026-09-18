---
title: The tool server
created: 2026-09-06
moved: 2026-09-18
---

`src/mcp` serves twelve tools by default - enough for an agent elsewhere to drive a session to completion - and eighteen more behind `--mcp-tools resources,terminals,automations,changes`, off unless asked for. What is still not there: prompts, resources, sampling and roots, none of which a tools-only server is obliged to answer, and `Mcp-Session-Id`, which the transport says a server MAY use and this one does not need.

What it still does not do is stream the reply. A `progressToken` gets a `notifications/progress` line per tool the agent reaches for, and on HTTP that is what opens an SSE stream, but MCP defines no way to send partial *result* content - so the text itself arrives whole at the end however long the turn took.
