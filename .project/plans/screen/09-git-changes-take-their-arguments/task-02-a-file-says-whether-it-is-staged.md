---
title: A file says whether it is staged
status: todo
depends: []
layer: "ahp, screen"
refs:
  - "[code://src/ahp/types.ts#L290-L313](../../../../src/ahp/types.ts#L290-L313) - `FileEdit`, which has no staging"
  - "[code://src/ahp/live.ts#L1258-L1287](../../../../src/ahp/live.ts#L1258-L1287) - `changeset()`, where the file's `_meta` is read"
  - "[code://src/screens.tsx#L1206](../../../../src/screens.tsx#L1206) - `ChangesScreen`, where the row is drawn"
  - file:///github/ahpapp/src/changes.ts - `staged` and `unstaged` from `_meta`, and a file that is both
---

## Objective

A file row carries `staged` and `unstaged` from the file's `_meta`, and the changes list marks a staged file, so a person can see what a commit will take.

## Files

- `UPDATE: src/ahp/types.ts:290-313` - `FileEdit.staged?: boolean` and `FileEdit.unstaged?: boolean`.
- `UPDATE: src/ahp/live.ts:1258-1287` - read `_meta.staged === true` and `_meta.unstaged === true`.
- `UPDATE: src/ahp/fake.ts` - one staged file and one staged-then-changed file on the working-tree changeset.
- `UPDATE: src/screens.tsx` - a mark on a staged row, and a different one for a file that is both.

## Steps

1. Read the two flags; a host that says nothing leaves both unset, and nothing is drawn.
2. Draw the mark in the row's existing status column, keeping the row one line.

## Validation

- `test/changes.test.tsx` - a staged file is marked, an unstaged one is not, and one that is both is told apart.
- Checked at 60 and 100 columns.

## Resume

