---
title: A cancel says one thing
status: todo
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
