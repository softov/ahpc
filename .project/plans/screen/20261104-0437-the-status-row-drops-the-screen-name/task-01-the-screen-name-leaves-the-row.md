---
title: The screen's name leaves the status row
status: todo
depends: []
layer: "screen"
refs:
  - "[code://src/app.tsx#L432-L479](../../../../src/app.tsx#L432-L479) - the status row"
---

## Objective

The status row ends with the hints or the host's sentence, and not with the screen's name.

## Files

- `UPDATE: src/app.tsx:432-479` - remove the screen's name and the `SCREEN` read from `Status`.
- `UPDATE: test/smoke.test.tsx` - the case in *Validation*.

## Steps

1. Remove the text that draws `SCREEN` at the end of the status row.
2. Remove the `SCREEN` read in `Status`.
3. Add the case in *Validation*.

## Validation

- On the sessions screen and on the changes screen, no text on the status row is the screen's name.
- With the text put back, that case fails.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
