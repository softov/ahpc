---
title: The model is read under both names
status: done
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

## Resume

All three steps are built. `src/ahp/live.ts` reads `_meta['ahpd.model']` first, then `_meta.model`, then `state.model`.
The comment above the read now names all three spellings and says why each one stays.

`test/reconnect.test.ts` holds one case per name and one with both, which is the three the plan asked for.
Two of them are new, because the `_meta.model` case already existed as `takes the same extension from _meta, where it is moving to`.
The case with both carries `ahpd.model` and `model` in one state, and asserts the `ahpd.` value.

`npm run typecheck` and `npm run build` are clean.
`npm test` is 684 passed and 1 failed of 685, and the failure is the one this worktree has at its baseline.
`_meta.cost` is untouched, as the plan asks.
