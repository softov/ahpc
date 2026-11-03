---
title: The list stays mounted when a row above it changes
status: implemented
depends: []
layer: "screen"
refs:
  - "[code://src/screens.tsx#L1391](../../../../src/screens.tsx#L1391) - `ChangesList` on the changes screen"
  - "[code://src/view/changes.tsx#L106](../../../../src/view/changes.tsx#L106) - the `List` in `ChangesList`"
  - "[code://src/ahp/fake.ts#L2221-L2232](../../../../src/ahp/fake.ts#L2221-L2232) - the fake's `review`"
---

## Objective

An update to the changeset does not remount the list of files.
The commit prompt keeps the focus while the actions row or the computing line comes or goes.

## Files

- `UPDATE: src/screens.tsx:1391` - add `key="files"` to `ChangesList`.
- `UPDATE: src/view/changes.tsx:106` - add `key="files"` to `List`.
- `UPDATE: src/ahp/fake.ts:2221-2232` - keep the operations in the changeset that `review` builds.
- `UPDATE: test/changes.test.tsx` - the cases in *Validation*.

## Steps

1. Add `key="files"` to `ChangesList` on the changes screen.
2. Add `key="files"` to the `List` in `ChangesList`.
3. In the fake's `review`, start the new changeset from the old one.
4. Add a test that types in the commit prompt after the actions row goes.
5. Add a test that types in the commit prompt after the computing line comes.

## Validation

- After an update removes the actions row, typed text reaches the commit prompt, and `s` stages nothing.
- After an update adds the computing line, typed text reaches the commit prompt.
- With either key removed, its case fails.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
