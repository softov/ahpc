---
title: The still waits on the host
status: done
depends: []
layer: "ahp and still"
refs:
  - "[code://src/ahp/live.ts#L1621](../../../../src/ahp/live.ts#L1621) - the client every request goes through"
  - "[code://src/tui.tsx#L273-L345](../../../../src/tui.tsx#L273-L345) - `still`"
---

## Objective

The live connection knows how many requests are open, and a still draws only when that number is zero, or after 10 seconds.

## Files

- `UPDATE: src/ahp/connection.ts:595` - add `idle?(limitMs: number): Promise<void>` beside `flush`.
- `UPDATE: src/ahp/live.ts:1621` - count each `request` and `subscribe` of the client until it settles.
- `UPDATE: src/ahp/live.ts:3460` - add `idle`, which resolves when the count is zero or the limit passes.
- `UPDATE: src/ahp/fake.ts` - add `idle`, which resolves at once.
- `UPDATE: src/tui.tsx:273-345` - in `still`, wait on the screen and the host in turns, 10 seconds in all, before the frame.
- `CREATE: test/still.test.ts` - the cases in *Validation*.

## Steps

1. Wrap the client's `request` and `subscribe` in `live.ts`, so each call counts as open until it settles.
2. Wrap the client that a reconnect makes in the same way.
3. Write `idle(limitMs)` from the count, with a timer for the limit.
4. Add `idle` to the scripted host, resolving at once.
5. In `still`, after `before`, wait for the host to go idle, then for the screen to settle.
6. Repeat that step while either of them changed.
7. Stop the repeat after 10 seconds in all, and draw what the screen holds.

## Validation

- `test/still.test.ts`: a host that answers `changesets` after 300 ms gives a still that lists the files.
- `test/still.test.ts`: a host that never answers gives a still after the cap, not a hang.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.

## Resume
