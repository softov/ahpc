---
title: The case expects the checkout's folder
status: implemented
depends: []
layer: "screen"
refs:
  - "[code://test/smoke.test.tsx#L1790-L1797](../../../../test/smoke.test.tsx#L1790-L1797) - the case"
---

## Objective

The case looks for the folder name of `process.cwd()` on the composer's second row, and not for `ahpc`.

## Files

- `UPDATE: test/smoke.test.tsx:1790-1797` - expect `basename(process.cwd())`.

## Steps

1. Import `basename` from `node:path`.
2. Replace `'ahpc'` in the case with `basename(process.cwd())`.

## Validation

- `npx vitest run test/smoke.test.tsx` passes in a clone named `othername`.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
