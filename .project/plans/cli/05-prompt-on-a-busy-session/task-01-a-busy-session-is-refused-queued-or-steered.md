---
title: A busy session is refused, queued behind or steered
status: todo
depends: []
layer: "cli, mcp, ahp"
refs:
  - "[code://src/wait.ts#L122-L200](../../../../src/wait.ts#L122-L200) - `turn`"
  - "[code://src/ahp/live.ts#L3015-L3031](../../../../src/ahp/live.ts#L3015-L3031) - `queue`, the pattern for `steer`"
---

## Objective

`prompt` and the MCP prompt tool check for a running turn before they send.
Without an option they refuse, with `queue` they send behind the turn, and with `steer` they send into it.

## Files

- `UPDATE: src/ahp/connection.ts:340-353` - add `steer(uri, text, model?)` beside `queue`, with a one-line doc comment.
- `UPDATE: src/ahp/live.ts:3015-3031` - add `steer`, which dispatches `chat/pendingMessageSet` with kind `steering` and a fresh id.
- `UPDATE: src/ahp/fake.ts:1992` - add `steer`. On a running turn it adds the text to that turn. With no running turn it refuses.
- `UPDATE: src/ahp/fake.ts` - `say` on a session with a running turn refuses, as ahpd host/87 does, and keeps the running turn.
- `UPDATE: src/control.ts:924-938` - the screen shows the host's refusal of a turn as one line, if it does not already.
- `UPDATE: src/wait.ts:122-200` - add `busy?: 'queue' | 'steer'` to `TurnOptions`. Send only after the first snapshot or event. Put the active turn's id in the baseline. With `steer`, wait for that turn. Without `busy` on a busy session, return a refusal the caller can print.
- `UPDATE: src/cli/main.ts:1575-1606` - add `--queue` and `--steer` to `prompt`. They exclude each other. Print the refusal on stderr and return 1.
- `UPDATE: src/cli/main.ts:51` - add `[--queue | --steer]` to the `prompt` usage line.
- `UPDATE: src/flags.ts` - add the two flags.
- `UPDATE: src/mcp/tools.ts:285-310` - add the optional `busy` input, with `queue` or `steer`. A refusal becomes the tool's error.
- `CREATE: test/busy.test.ts` - the cases in Validation.

## Steps

1. Write the tests first, against the scripted host.
2. Add `steer` to the connection, the live host and the scripted host.
3. Change `turn` so that it reads the first state before it sends.
4. Add the flags to `prompt` and the input to the MCP tool.
5. Write the refusal as one plain sentence: "A turn is running. Use --queue or --steer."

## Validation

- A test: plain `prompt` on a busy session returns 1, writes the refusal, and dispatches nothing.
- A test: `prompt --queue` on a busy session returns the new turn, not the running one.
- A test: `prompt --steer` dispatches kind `steering` and returns the running turn when it ends.
- A test: `prompt --queue --steer` returns a usage error.
- A test: `prompt` on an idle session works as before, with or without the flags.
- A test: the scripted host refuses `say` on a busy session, and the running turn stays.
- A test: the MCP tool refuses without `busy` and queues with `busy: queue`.
- `npm run typecheck` and `npx vitest run` pass.
