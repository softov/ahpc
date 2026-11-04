---
title: MCP over stdio answers each call when it is done
domain: cli
status: active
priority: high
created: 2026-11-04
revalidated: 2026-11-04
refs:
  - git://b2a9e35 - the commit the facts were checked at, and the last commit that holds the brief `briefs/mcp-over-stdio-answers-calls-at-the-same-time.md`
  - "[code://src/mcp/stdio.ts#L20-L68](../../../../src/mcp/stdio.ts#L20-L68) - `stdio` chains each message on the one before, so a message waits until the last answer is out"
  - "[code://src/mcp/serve.ts#L175-L233](../../../../src/mcp/serve.ts#L175-L233) - `answer` drops every notification, `notifications/cancelled` too, and answers `ping` with `{}`"
  - "[code://src/mcp/serve.ts#L102](../../../../src/mcp/serve.ts#L102) - `call`, which runs one tool"
  - "[code://src/mcp/tools.ts#L81](../../../../src/mcp/tools.ts#L81) - `Tool.run`, which takes no signal today"
  - "[code://src/mcp/tools.ts#L292-L345](../../../../src/mcp/tools.ts#L292-L345) - `send_turn`, which blocks until the turn ends, 900 s by default"
  - "[code://src/wait.ts#L174-L325](../../../../src/wait.ts#L174-L325) - `turn`, which says, queues or steers, then waits through `until`"
  - "[code://src/wait.ts#L21-L60](../../../../src/wait.ts#L21-L60) - `until`, which closes its subscription on every way out"
  - "[code://src/ahp/connection.ts#L369-L389](../../../../src/ahp/connection.ts#L369-L389) - `stopTurn`, `queue` with the queued id, and `unqueue` on the seam"
  - "[code://src/mcp/http.ts](../../../../src/mcp/http.ts) - the HTTP transport, one request for each POST, with no client sessions"
  - "[code://test/mcp.test.ts](../../../../test/mcp.test.ts) - the MCP tests, which call `answer` and `call` directly"
  - https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/ping - "The receiver MUST respond promptly with an empty response"
  - https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation - a receiver SHOULD stop a cancelled request and send no response; `initialize` MUST NOT be cancelled; an unknown or finished request id is ignored
  - https://www.jsonrpc.org/specification - a response carries the id of its request, so a client matches answers by id and not by order
  - file:///github/ahpd/node_modules/.pnpm/@modelcontextprotocol+sdk@1.30.0_zod@4.5.4/node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.js - the official SDK 1.30.0 starts each request as it arrives, and keeps an `AbortController` for each one
---

## Goal

`ahpc mcp` over stdio complies with MCP `2025-06-18`.
It starts each request as it arrives and answers each one when it is done, in any order.
A `ping` gets its answer at once, and `notifications/cancelled` stops the request it names.
So a client can answer a confirmation with `confirm_tool_call` while its `send_turn` waits on that confirmation.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `rg "running = running.then" src/mcp` - only `stdio` chains its messages.
- `rg "notifications/" src/mcp` - `answer` returns nothing for every notification.
- `rg "AbortSignal|signal" src/mcp src/wait.ts` - nothing takes a signal today.
- `rg "stdio" test` - no test covers `stdio`. It reads `process.stdin` and writes `process.stdout` directly.

### Runtime path

```
stdin line -> stdio parses it -> answer(..., { signal }) -> call -> Tool.run(host, input, report, signal) -> one whole line on stdout
notifications/cancelled -> stdio finds the request in flight -> abort -> no line for that id
```

### Gaps

- `stdio` runs one message at a time, so a `ping` and every tool wait behind a `send_turn`.
- `notifications/cancelled` does nothing.
- `turn` cannot be stopped before its timeout, and it does not keep the id that `queue` returns.

## Answers

| What | Source | Task |
| --- | --- | --- |
| `stdio` starts each request as it arrives, and writes each response as one whole line when its request is done | Softov, 2026-11-04: "need a brief for planning for a fix to be protocol compliance" | 01 |
| `ping` is answered at once, whatever else runs | MCP `2025-06-18` ping: "MUST respond promptly" | 01 |
| At the end of stdin, the server waits for the requests in flight, then exits | (defaulted: an answer that was started is owed) | 01 |
| `stdio` takes its input and output streams as arguments, `process.stdin` and `process.stdout` by default | (defaulted: a test needs streams it can write and read) | 01 |
| `notifications/cancelled` stops the request it names, and no response goes out for it | MCP `2025-06-18` cancellation: SHOULD | 02 |
| The stop reaches a tool as an `AbortSignal`, the fourth argument of `Tool.run` | (defaulted: the official SDK keeps an `AbortController` for each request) | 02 |
| A cancellation of `initialize`, or of an id that is unknown or done, is ignored | MCP `2025-06-18` cancellation | 02 |
| A cancelled `send_turn` stops the turn it started on the host, and takes back a message it queued | Softov, 2026-11-04: "Stop the turn too" | 02 |
| A cancelled `send_turn` that steered leaves the running turn alone | (defaulted: a steered message starts no turn, and the answer above stops only the turn it started) | 02 |
| A message not yet sent when the cancel comes is never sent | (defaulted: nothing was started, so nothing is left to stop) | 02 |
| `stopTurn` goes out at once after `say`, without a wait for the turn to start | (defaulted: one socket keeps the order, so the host has the turn when the stop arrives) | 02 |
| Cancellation is for stdio only. HTTP cancellation is [an idea](../../../ideas/mcp-over-http-stops-a-cancelled-call.md) | Softov, 2026-11-04: "stdio only, HTTP as an idea" | 02 |

## Proposed architecture

- **Data flow** - `stdio` keeps a map of the requests in flight, from request id to an `AbortController` and the request's promise.
- **Event flow** - each line starts its own promise. A response is written when that promise settles, unless its controller was aborted.
- **State flow** - `turn` records what it sent: a turn it started, a queued id, or a steer. An abort ends the wait and undoes the first two.
- **Layer responsibilities** - `src/mcp/stdio.ts`: the map and the cancellation · `src/mcp/serve.ts` and `src/mcp/tools.ts`: the signal · `src/wait.ts`: the stop.
- **Source-of-truth files** - [`code://src/mcp/stdio.ts`](../../../../src/mcp/stdio.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - Each request runs as it arrives](task-01-each-request-runs-as-it-arrives.md) | implemented | - |
| [02 - A cancelled request stops](task-02-a-cancelled-request-stops.md) | implemented | 01 |

## Risks and tradeoffs

- Two tool calls on one session can now run at the same time. Each call goes to the host, which already serves many clients at once.
- A response line must never mix with another. Each response is one `write` of one whole line.
- Over HTTP, a cancelled call still runs to its end, as it does today.

## Resume state

- **Done so far:** planned 2026-11-04, and tasks 01 and 02 implemented 2026-11-04.
- **Next action:** Softov reviews the pull request, and checks `ping` by hand as [the pending check](../../../pending/mcp-over-stdio-checks.md) says.
- **Open questions:** none.
- **Watch out for:** the scripted host sends its first snapshot inside `subscribe`, so `until` can finish before `subscribe` returns.

## Final verification checklist

- [ ] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
- [ ] A test sends `send_turn` and `ping` together over `stdio`, and gets the `ping` answer first.
- [ ] A test answers a confirmation with `confirm_tool_call` while `send_turn` waits on it.
- [ ] A test cancels `send_turn`: no response comes for it, and the host stopped the turn.
- [ ] By hand, against ahpd, `ahpc mcp` answers `ping` while `send_turn` runs.
