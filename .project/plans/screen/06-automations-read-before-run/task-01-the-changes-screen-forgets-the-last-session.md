---
title: The changes screen forgets the last session
status: done
depends: []
layer: "screen"
refs:
  - "[code://src/control.ts](../../../../src/control.ts) - where it changed"
---

## Objective

forgetChanges() in open() and close() resets CHANGES, CHANGE_SCOPES, CHANGE_AT, CHANGE_ROW and OPEN_FILE; ChangesScreen drops an answer for a session or scope no longer on screen.

## Validation

- test/changes.test.tsx: "shows the next session its own changes", which fails with the reset removed.
- `npx vitest run` passes.

## Resume

Done 2026-09-26, validated by Softov.
