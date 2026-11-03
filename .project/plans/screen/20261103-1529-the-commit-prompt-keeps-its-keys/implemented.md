---
title: The commit prompt keeps its keys while the changeset changes - implemented
date: 2026-11-03
refs:
  - "[code://src/screens.tsx](../../../../src/screens.tsx) - `key` on `ChangesList`"
  - "[code://src/view/changes.tsx](../../../../src/view/changes.tsx) - `key` on the `List`"
  - "[code://src/ahp/fake.ts](../../../../src/ahp/fake.ts) - `review` keeps the operations"
  - "[code://test/changes.test.tsx](../../../../test/changes.test.tsx) - `updatedUnderPrompt` and its two cases"
---

The list of files stays mounted when the actions row or the computing line comes or goes.
Its `autoFocus` does not run again, so the commit prompt keeps the focus and the keys.

## What was built

- [`code://src/screens.tsx`](../../../../src/screens.tsx) - `key="files"` on `ChangesList`.
- [`code://src/view/changes.tsx`](../../../../src/view/changes.tsx) - `key="files"` on the `List`.
- [`code://src/ahp/fake.ts`](../../../../src/ahp/fake.ts) - `review` starts the new changeset from the old one, so the operations stay.
- [`code://test/changes.test.tsx`](../../../../test/changes.test.tsx) - two cases type in the commit prompt after an update removes the actions row or adds the computing line.

## Verified

- `npm run typecheck` clean.
- `npm run build` clean.
- `npx vitest run` - 838 of 838 passed.
- Mutations: without the key on `ChangesList`, the actions row case failed. Without the key on the `List`, the computing line case failed.

## Departures from the plan

- None.
