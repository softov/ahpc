---
title: A cancel says one thing
status: done
depends: []
layer: "cli, ahp"
refs:
  - "[code://src/ahp/live.ts#L3058-L3081](../../../../src/ahp/live.ts#L3058-L3081) - `stopTurn` sends its reason to `onRefusal` and resolves `false`"
  - "[code://src/cli/main.ts#L1662-L1668](../../../../src/cli/main.ts#L1662-L1668) - `cancel` prints \"No turn is running.\" after that"
  - "[code://src/wait.ts#L83-L85](../../../../src/wait.ts#L83-L85) - `failure` reads error parts only"
---

## Objective

`cancel` prints one line when it cannot cancel: the host's reason, or "No turn is running.".
A `prompt` whose turn was cancelled prints "The turn was cancelled." on stderr and exits 1.

## Files

- `UPDATE: src/ahp/connection.ts:348` - `stopTurn` resolves `{ cancelled: boolean; refused?: string }`.
- `UPDATE: src/ahp/live.ts:3058-3081` - `stopTurn` returns the reason instead of sending it to `onRefusal`.
- `UPDATE: src/ahp/fake.ts:2039` - `stopTurn` resolves the new shape.
- `UPDATE: src/cli/main.ts:1662-1668` - `cancel` prints the reason when there is one, else "No turn is running.".
- `UPDATE: src/cli/main.ts:1620-1642` - `prompt` prints "The turn was cancelled." when the turn's state is `cancelled`.
- `UPDATE: src/mcp/tools.ts:359` - `cancel_turn` reads `cancelled` from the new shape.
- `UPDATE: src/control.ts:949` - the screen sends the reason to its refusal line.
- `UPDATE: test/oneshot.test.ts` - the cases in *Validation*.

## Steps

1. Change `stopTurn` to resolve `{ cancelled, refused? }`.
2. Return the reason in `refused`, and do not call `onRefusal` from `stopTurn`.
3. In the screen, report `refused` the way `onRefusal` did.
4. In `cancel`, print `refused` or "No turn is running.", one line, and return 1.
5. In `prompt`, print the cancel line when the state of the turn is `cancelled`.
6. Add the tests.

## Validation

- `test/oneshot.test.ts`: `cancel` on a session with no chat prints one line.
- `test/oneshot.test.ts`: `prompt` prints the cancel line and exits 1 when another client cancels its turn.
- `npm test` passes.

## Resume

`stopTurn` resolves `{ cancelled: boolean; refused?: string }` at `src/ahp/connection.ts:361`.
`src/ahp/live.ts:3111` reads the chat, returns `{ cancelled: false }` where no turn is running, and sends through `sent`; a session with no chat answers with `channels.refusal` or `This session has no chat to stop a turn in.`, and the catch returns `reason(error)` in `refused` instead of telling `onRefusal`.
`src/ahp/fake.ts:2053` answers `{ cancelled: running }`.
`cancel` at `src/cli/main.ts:1682` returns `exitOf(stopped)` when `refused` is set, 0 when `cancelled`, and prints `No turn is running.` and returns 1 otherwise, so the two messages never both print.
`prompt` prints `The turn was cancelled.` at `src/cli/main.ts:1632` when the turn came back `cancelled`.
`cancel_turn` at `src/mcp/tools.ts:375` answers `{ cancelled }` and throws a refusal through `applied`.
`stop()` at `src/control.ts:952` reports `refused` through `failed`, which is where `onRefusal` put it.
`test/oneshot.test.ts` holds three cancel cases and the prompt one; its mock now varies the session state so a test can leave the session no chat.

Departures:

- The no-chat sentence is new wording, `This session has no chat to stop a turn in.`, because the plan asked for one line and `answered`'s lowercase fallback is a fragment of a sentence.
- The prompt case is driven by another client's `chat/turnCancelled` action on the chat, which the SDK reducer turns into a turn with state `cancelled`; the command path is the same one a host's own action takes.
