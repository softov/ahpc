---
title: The model is read under both names
status: todo
depends: []
layer: "ahp"
refs:
  - "[code://src/ahp/live.ts#L3218-L3223](../../../../src/ahp/live.ts#L3218-L3223) - the read"
---

## Objective

The last model of a session is read from `_meta['ahpd.model']`, then from `_meta.model`.

## Files

- `UPDATE: src/ahp/live.ts:3223` - read `ahpd.model` before `model`.
- `UPDATE: test/reconnect.test.ts` - a case for each name, and one with both.

## Steps

1. Write the three test cases.
2. Change the read at `src/ahp/live.ts:3223`.
3. Run `npm run typecheck`, `npm run build` and `npm test`.

## Validation

- A state with only `_meta['ahpd.model']` gives that model.
- A state with only `_meta.model` gives that model.
- A state with both gives the `ahpd.` value.
- `npm run typecheck`, `npm run build` and `npm test` pass.
