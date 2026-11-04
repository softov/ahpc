---
title: MCP over stdio answers each call when it is done - implemented
date: 2026-11-04
refs:
  - git://163a205 - the commit this was built on
  - "[code://src/mcp/stdio.ts](../../../../src/mcp/stdio.ts) - the transport, which runs each request as it arrives and stops the one a cancel names"
  - "[code://src/wait.ts](../../../../src/wait.ts) - `until` and `turn`, which end a wait on an abort and undo what was sent"
  - "[code://test/stdio.test.ts](../../../../test/stdio.test.ts) - the cases over the transport"
---

`ahpc mcp` over stdio now starts each request as its line arrives.
It answers each one when it is done, in whatever order that turns out to be.
So a `ping` is answered while a `send_turn` waits.
A client can also answer a confirmation with `confirm_tool_call` while the call that stopped on it is still open.
A client can cancel a request with `notifications/cancelled`, and the turn that request started is stopped on the host.
No response goes out for a cancelled request, which is what MCP `2025-06-18` asks of a receiver.

## What was built

- [`code://src/mcp/stdio.ts`](../../../../src/mcp/stdio.ts) - takes `input` and `output`, starts each message as its line arrives, and writes each response as one `write` of one whole line. It keeps an `AbortController` for each request id in flight, aborts the one a cancellation names, and writes nothing for it.
- [`code://src/mcp/serve.ts`](../../../../src/mcp/serve.ts) - `call` and `answer` take an optional `signal`, and pass it to `Tool.run`.
- [`code://src/mcp/tools.ts`](../../../../src/mcp/tools.ts) - `Tool.run` takes the signal as its fourth argument, and `send_turn` passes it to `turn`.
- [`code://src/wait.ts`](../../../../src/wait.ts) - `until` finishes with `undefined` when the signal aborts and removes its listener on every way out. `turn` stops a turn it started, takes back a message it queued by the id the host gave it, and leaves a steered turn alone.
- [`code://test/stdio.test.ts`](../../../../test/stdio.test.ts) - the four cases on order, and two on cancellation.
- [`code://test/busy.test.ts`](../../../../test/busy.test.ts) - six cases on a cancelled turn.

## Verified

- `test/stdio.test.ts` holds 6 tests.
- They cover a `ping` answered before a waiting `send_turn`, and `confirm_tool_call` answered while `send_turn` waits.
- They cover the end of the input waiting for a request in flight, and a line that is not JSON.
- They cover a cancellation that stops the turn it names, sends nothing for it, and leaves a `ping` answered.
- They cover a cancellation of an unknown id, which changes nothing.
- `test/busy.test.ts` holds 15 tests, 6 of them new.
- An abort after `say` calls `stopTurn` once, and an abort after `queue` calls `unqueue` with the host's id.
- An abort after `steer` calls neither, and an abort before the first event sends nothing.
- An abort after the host started the queued message calls `stopTurn`.
- An abort after the turn has answered calls neither.
- The three aborts end their wait at once rather than at their timeout.
- The gates pass: `npm run -s typecheck`, `npm run -s build`, and `npx vitest run` with 896 tests in 44 files.
- Each new test was checked against the fix it covers.
- Removing the abort call, the no-response guard, the id lookup, or the abort listener made the transport cases fail.
- Removing `stopTurn`, `unqueue`, the steer distinction, or the pre-send guard made the turn cases fail.
- The fix was put back after every one.

## Departures from the plan

- Step 13 named `CREATE: .project/ideas/mcp-over-http-stops-a-cancelled-call.md`. The file already existed with the content the step asked for, committed in 163a205, so nothing was created.
- `call` takes the signal as a sixth argument, after `groups`, so the HTTP transport's call is unchanged. The plan did not name a position for it.
- Review on 2026-11-04 added two cases that the steps did not name.
- A queued message that the host has already started is out of the queue, so `unqueue` does nothing. `turn` now records the first turn not in its baseline, and a cancel stops it.
- A cancel that arrives after the turn has answered undoes nothing. Before, it sent `stopTurn` to whatever turn ran next.
- The answer to `queue` has a catch, so a refused queue with no cancel is not an unhandled rejection.
- Removing either fix makes its case fail.

## Left for later

- HTTP cancellation stays the idea in [.project/ideas/mcp-over-http-stops-a-cancelled-call.md](../../../ideas/mcp-over-http-stops-a-cancelled-call.md), because HTTP keeps no client sessions to match a request id to.
