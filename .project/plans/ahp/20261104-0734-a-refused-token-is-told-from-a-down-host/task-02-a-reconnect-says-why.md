---
title: A reconnect says why it cannot get back
status: implemented
depends: 
  - task-01-one-request-tells-why.md
layer: "ahp"
refs:
  - "[code://src/ahp/live.ts#L1905-L1958](../../../../src/ahp/live.ts#L1905-L1958) - the reconnect loop, whose catch says nothing"
  - "[code://src/connect.ts#L135](../../../../src/connect.ts#L135) - `onState`, which already reports `offline`"
---

## Objective

While reconnects fail, the status row says the reason from `whyNoConnection`, and clears it once connected.

## Files

- `UPDATE: src/ahp/live.ts:61-95` - add `onRetryFailed(error)` to the options
- `UPDATE: src/ahp/live.ts:1905-1958` - call `onRetryFailed` from the catch of a failed attempt
- `UPDATE: src/connect.ts:135` - report the sentence from `whyNoConnection` on a failed retry, and clear it on `connected`
- `UPDATE: test/reconnect.test.ts` - the cases in *Validation*

## Steps

1. Add `onRetryFailed` to the options of `liveHost`.
2. Call it with the error when a reconnect attempt fails.
3. In `connect`, ask `whyNoConnection` and report the sentence through `sink.report`.
4. Report a sentence only when it differs from the last one reported.
5. Clear the line when the state moves to `connected`.
6. Add the cases in *Validation*.

## Validation

- A reconnect that fails on a 401 puts the refused sentence on the status row.
- The retries go on, and a host that accepts the token again connects.
- The line is gone after the connection comes back.
- The same failure twice reports the sentence once.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
