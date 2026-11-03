---
title: The host's sentence has its own slot
status: todo
depends: []
layer: "screen"
refs:
  - "[code://src/control.ts#L1549-L1570](../../../../src/control.ts#L1549-L1570) - `answered`"
  - "[code://src/app.tsx#L432-L472](../../../../src/app.tsx#L432-L472) - the status row"
---

## Objective

The host's answer to a changeset verb shows on the status row in the success tone.

## Files

- `UPDATE: src/state.ts:198-202` - add `HOST_NOTE` after `HOST_LINK`.
- `UPDATE: src/control.ts:1549-1570` - `answered` writes the sentence to `HOST_NOTE`.
- `UPDATE: src/control.ts:703-712` - `forgetChanges` clears `HOST_NOTE`.
- `UPDATE: src/app.tsx:432-472` - draw `HOST_NOTE` in the success tone, after the link.
- `UPDATE: test/changes.test.tsx` - the cases in *Validation*.

## Steps

1. Add `HOST_NOTE` to `src/state.ts`, after `HOST_LINK`.
2. In `answered`, write the host's sentence to `HOST_NOTE` when the answer has no link.
3. In `answered`, clear `HOST_ERROR` and `HOST_LINK` with that write.
4. In `answered`, clear `HOST_NOTE` when the answer has a link.
5. Keep an answer that this client cannot read in `HOST_ERROR`.
6. Clear `HOST_NOTE` in `forgetChanges`.
7. Draw `HOST_NOTE` on the status row in the success tone, after the link.
8. Add the cases in *Validation*.

## Validation

- After a commit, the status row shows "Committed 1a2b3c4" in the success tone.
- After a commit, `HOST_ERROR` is empty.
- The sentence is gone once another session opens.
- An answer that this client cannot read still shows in `HOST_ERROR`.
- With the sentence written to `HOST_ERROR` again, the tone case fails.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
