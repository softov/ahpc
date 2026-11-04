---
title: A refusal stays on the page it came from
status: done
depends: [task-01-a-refusal-names-its-action-and-session.md]
layer: screen
refs:
  - "[code://src/control.ts#L826-L895](../../../../src/control.ts#L826-L895) - `open` and `close`, which gain the clear"
  - "[code://src/control.ts#L1028-L1034](../../../../src/control.ts#L1028-L1034) - `disposeSession`, whose report moves after the close"
---

## Objective

A refusal shows only while the page it was sent from is open.
Opening a session, or leaving one for the list or the new session page, clears the row.

## Files

- `UPDATE: src/control.ts:484-498` - `failed` and `told` read `OPEN` when called, and draw nothing if `OPEN` changed before the answer.
- `UPDATE: src/control.ts:826-895` - `open` and `close` set `HOST_ERROR` to `null`.
- `UPDATE: src/control.ts:1028-1034` - `disposeSession` reports its refusal after `close`.
- `UPDATE: test/smoke.test.tsx` - the cases in *Validation*.

## Steps

1. In `told`, read `OPEN` before the action goes, and pass it to `failed` with the answer.
2. In `failed`, draw nothing when that `OPEN` is not the `OPEN` of now.
3. In `open`'s `detail` catch, pass the `OPEN` of the call in the same way.
4. Set `HOST_ERROR` to `null` at the start of `open` and of `close`.
5. In `disposeSession`, keep the error, call `close` when the session was open, and then report.

## Validation

- A test: the host refuses `detail` for the opened session, then `close` runs; the row is empty.
- A test: a `told` action whose answer arrives after another session opened draws nothing.
- A test: a refused action on the open session still shows its line.
- A test: a refused `disposeSession` of the open session shows its line after the close.
- Run `npm run typecheck` and `npx vitest run`, one after the other, and check that both pass.

## Resume

- Implemented 2026-11-03; awaits review. See [implemented.md](implemented.md).
