---
title: A cancelled request stops
status: implemented
depends: [task-01-each-request-runs-as-it-arrives.md]
layer: "mcp"
refs:
  - "[code://src/mcp/tools.ts#L81](../../../../src/mcp/tools.ts#L81) - `Tool.run`, which gets the signal"
  - "[code://src/mcp/tools.ts#L292-L345](../../../../src/mcp/tools.ts#L292-L345) - `send_turn`, which passes it to `turn`"
  - "[code://src/wait.ts#L174-L325](../../../../src/wait.ts#L174-L325) - `turn`, which stops or takes back what it sent"
  - "[code://src/ahp/connection.ts#L369-L389](../../../../src/ahp/connection.ts#L369-L389) - `stopTurn` and `unqueue`"
---

## Objective

`notifications/cancelled` stops the request it names, and no response goes out for that request.
A cancelled `send_turn` stops the turn it started, or takes back the message it queued.

## Files

- `UPDATE: src/mcp/stdio.ts` - keep an `AbortController` for each request id; abort it on `notifications/cancelled`; write no response for an aborted request.
- `UPDATE: src/mcp/serve.ts:102` - `call` takes a signal and passes it to `Tool.run`.
- `UPDATE: src/mcp/serve.ts:175-233` - `answer` takes a `signal` option and passes it to `call`.
- `UPDATE: src/mcp/tools.ts:81` - `Tool.run` takes an optional `AbortSignal` as its fourth argument.
- `UPDATE: src/mcp/tools.ts:312-345` - `send_turn` passes the signal to `turn`.
- `UPDATE: src/wait.ts:103-128` - `TurnOptions` takes `signal`.
- `UPDATE: src/wait.ts:174-325` - `turn` ends its wait on an abort, then stops or takes back what it sent.
- `UPDATE: src/wait.ts:21-60` - `until` takes `signal`, and finishes when it aborts.
- `CREATE: .project/ideas/mcp-over-http-stops-a-cancelled-call.md` - HTTP cancellation, for when HTTP has client sessions.
- `UPDATE: test/stdio.test.ts` - the cancellation cases in *Validation*.
- `UPDATE: test/busy.test.ts` - the `turn` cases in *Validation*.

## Steps

1. In `stdio`, keep an `AbortController` for each request id in flight.
2. On `notifications/cancelled`, read `params.requestId`, and abort its controller.
3. Ignore a cancellation for `initialize`, and for an id that is not in flight.
4. When an aborted request settles, write no response for it.
5. Pass the signal from `answer` to `call`, and from `call` to `Tool.run`.
6. In `send_turn`, pass the signal to `turn`.
7. In `until`, finish with `undefined` when the signal aborts, and remove the listener on every way out.
8. In `turn`, send nothing if the signal aborts before the message goes.
9. In `turn`, keep the id that `queue` returns.
10. After an abort, call `stopTurn` if the message was said to an idle session.
11. After an abort, call `unqueue` with the kept id if `turn` queued the message.
12. After an abort, leave a steered turn alone.
13. Write the idea file for HTTP cancellation from the idea template.

## Validation

- `test/stdio.test.ts`: `send_turn`, then `notifications/cancelled` for its id; no response for that id comes out.
- `test/stdio.test.ts`: after that cancellation, a `ping` gets its answer.
- `test/stdio.test.ts`: a cancellation for an unknown id changes nothing.
- `test/busy.test.ts`: an abort after `say` calls `stopTurn` once.
- `test/busy.test.ts`: an abort after `queue` calls `unqueue` with the queued id.
- `test/busy.test.ts`: an abort after `steer` calls neither `stopTurn` nor `unqueue`.
- `test/busy.test.ts`: an abort before the first event sends nothing.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.

## Resume

Built 2026-11-04.
`stdio` keeps an `AbortController` for each request id in flight, and `notifications/cancelled` aborts the request it names.
A cancellation of `initialize` or of an id that is not in flight is ignored, and an aborted request writes no response.
The signal goes from `answer` to `call`, and from `call` to `Tool.run` as its fourth argument.
`send_turn` passes it to `turn`, and `until` ends its wait when it aborts, at once rather than at the timeout.
`turn` then stops a turn it started and takes back a message it queued, and leaves a steered turn alone.
The idea file for step 13 already existed with the content the step asked for, so nothing was created.
`test/stdio.test.ts` holds two cancellation cases, and `test/busy.test.ts` holds four.
The gates pass: typecheck, build, and 894 tests in 44 files.
Nothing is left in this task.
