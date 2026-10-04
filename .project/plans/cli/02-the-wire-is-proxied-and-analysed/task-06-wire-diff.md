---
title: wire diff compares two captures
status: todo
depends: [task-01-one-reader.md]
layer: "cli"
refs:
  - "[code://src/wire.ts](../../../../src/wire.ts) - the reader both sides go through"
---

## Objective

`ahpc wire diff <a> <b> [--json]` lists the methods, action types and field paths one capture has and the other lacks.

## Files

- `CREATE: src/wirediff.ts`.
- `UPDATE: src/cli/main.ts`.
- `CREATE: test/wirediff.test.ts`.

## Steps

1. For each capture, a set of method names, action types, and field paths per method and per action type (`params.x.y`, `result.x`, `action.x`), arrays collapsed to `[]`.
2. Print three groups: only in A, only in B, and counts for what both have.
3. Values are never printed, only paths.

## Validation

- Two captures differing by one action type and one field give exactly those two lines.

## Resume

