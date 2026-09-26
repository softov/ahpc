---
title: A narrow catalogue draws one pane
status: done
depends: []
layer: "screen"
refs:
  - "[code://src/screens.tsx](../../../../src/screens.tsx) - where it changed"
---

## Objective

SessionsScreen skips the list Panel when the pane is out and the width is at or under splitAt; the pane takes flex 1.

## Validation

- test/smoke.test.tsx: "draws the pane alone while it is out on a narrow terminal", and the width-follows-focus test moved above a lowered split.
- `npx vitest run` passes.

## Resume

Done 2026-09-26, validated by Softov.
