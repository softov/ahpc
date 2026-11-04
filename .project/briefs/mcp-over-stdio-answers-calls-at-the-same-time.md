---
title: MCP over stdio answers calls at the same time
created: 2026-11-04
refs:
  - git://32e0f9e - the commit of this repository the facts were checked at
  - "[code://src/mcp/stdio.ts#L13-L52](../../src/mcp/stdio.ts#L13-L52) - `stdio` chains each message on the one before, so a message waits until the last answer is out"
  - "[code://src/mcp/serve.ts#L194-L233](../../src/mcp/serve.ts#L194-L233) - `answer` drops every notification, `notifications/cancelled` too, and answers `ping` with `{}`"
  - "[code://src/mcp/serve.ts#L22](../../src/mcp/serve.ts#L22) - the server speaks MCP `2025-06-18`"
  - "[code://src/mcp/tools.ts#L292-L345](../../src/mcp/tools.ts#L292-L345) - `send_turn` blocks until the turn ends, 900 s by default, and keeps waiting while the agent asks"
  - "[code://src/mcp/tools.ts#L381](../../src/mcp/tools.ts#L381) - `wait_for_attention`, the tool `send_turn` points a caller at while it waits"
  - "[code://src/mcp/tools.ts#L424-L451](../../src/mcp/tools.ts#L424-L451) - `confirm_tool_call` and `answer_question`"
  - "[code://src/mcp/http.ts](../../src/mcp/http.ts) - the HTTP transport, one request for each POST"
  - https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/ping - \"The receiver MUST respond promptly with an empty response\"
  - https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation - a receiver of `notifications/cancelled` SHOULD stop the request and send no response for it
  - https://www.jsonrpc.org/specification - a response carries the id of its request, so a client matches answers by id and not by order
  - file:///github/ahpd/node_modules/.pnpm/@modelcontextprotocol+sdk@1.30.0_zod@4.5.4/node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.js - the official SDK 1.30.0, which starts each request as it arrives
---

# MCP over stdio answers calls at the same time

`ahpc mcp` over stdio starts each request as it arrives, and answers each one when it is done, in any order.
The aim is a server that complies with MCP `2025-06-18`.
Softov, 2026-11-04: "This one need a brief for planning for a fix to be protocol compliance".
A check by hand on 2026-11-03 found that the server does one call at a time.

## What others do

- The official TypeScript SDK, at 1.30.0, calls each request's handler as the request arrives, with no wait on the requests before it (`Protocol._onrequest`).
- The SDK keeps an `AbortController` for each request in flight. `notifications/cancelled` aborts the request's controller, and the SDK then sends no response for it (`_oncancel`).
- MCP's ping page says the receiver "MUST respond promptly". A sender that gets no answer "MAY" think the connection is stale and close it.
- MCP's cancellation page says a receiver "SHOULD" stop a cancelled request, free its resources, and send no response for it.

## What ahpc has today

- `stdio` chains each message on the promise of the message before it ([`code://src/mcp/stdio.ts#L13-L52`](../../src/mcp/stdio.ts#L13-L52)). Its comment gives the reason: an answer out of order.
- JSON-RPC matches a response to its request by id, so an answer out of order is valid.
- `send_turn` blocks until the turn ends, up to `timeoutSeconds`, 900 by default ([`code://src/mcp/tools.ts#L292-L345`](../../src/mcp/tools.ts#L292-L345)).
- While the agent asks for an approval or an answer, `send_turn` keeps waiting. Its description tells the caller to use `wait_for_attention`.
- Over stdio, `wait_for_attention`, `confirm_tool_call` and `answer_question` wait behind that `send_turn`. So a turn that asks a person cannot be answered from the same client until `send_turn` times out.
- A `ping` behind a `send_turn` waits for it too, against the ping page's "MUST respond promptly".
- `answer` drops every notification, so `notifications/cancelled` does nothing ([`code://src/mcp/serve.ts#L194-L233`](../../src/mcp/serve.ts#L194-L233)).
- The HTTP transport takes one request for each POST, so its calls already run at the same time.

## Who writes

- `/github/ahpc` is on `main`, clean, at `32e0f9e`.
- No pull request is open on ahpc.
- No plan touches `src/mcp/`.

## The change

- `stdio` parses each line in order, and starts each request as it arrives, with no wait on the requests before it.
- Each response goes out when its request is done, as one whole line on stdout.
- `ping` is answered at once, whatever else runs.
- `notifications/cancelled` stops the matching request, and the server sends no response for it.
- A cancelled `send_turn` cancels the turn it started on the host, and takes back a message it queued. Softov, 2026-11-04: "Stop the turn too".
- At the end of stdin, the server waits for the requests in flight before it exits.
- A test sends `send_turn` and `ping` together, and gets the `ping` answer first.
- A test answers a confirmation with `confirm_tool_call` while `send_turn` waits on it.
