---
title: The three edges
status: done
depends: []
layer: "ahp"
refs:
  - "[code://src/control.ts#L679-L696](../../../../src/control.ts#L679-L696) - `signIn`"
  - "[code://src/control.ts#L1297](../../../../src/control.ts#L1297) - the controller's `dispose`"
  - "[code://src/view/auth.tsx#L79](../../../../src/view/auth.tsx#L79) - Enter in the field"
---

## Objective

`signIn` keeps its resource, the field sends once, and `dispose` settles the waiters.

## Files

- `UPDATE: src/control.ts:679-696` - write the error only while the answered resource is the one on screen
- `UPDATE: src/control.ts:1297` - call `settle(null)` before the bag is disposed
- `UPDATE: src/view/auth.tsx:79` - skip `form.submit()` while `form.submitting` is set
- `UPDATE: test/auth.test.tsx` - the cases in *Validation*

## Steps

1. In `signIn`, write the error only when `AUTH_ASK` still has the same resource.
2. In the field's `onSubmit`, return when `form.submitting` is true.
3. In `dispose`, call `settle(null)` first.
4. Add the cases in *Validation*.

## Validation

- A refusal for `A` that comes back after an ask for `B` writes nothing under `B`.
- Two Enter presses during one slow `authenticate` send one `authenticate`.
- Disposing the controller resolves a waiting act as declined.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
