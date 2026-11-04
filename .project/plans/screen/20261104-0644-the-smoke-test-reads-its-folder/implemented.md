---
title: The smoke test reads the checkout's folder name - implemented
date: 2026-11-04
---

## What exists now

- The case "puts where the session runs on a row of its own" expects `basename(process.cwd())` on the composer's second row.

## Verified

- In a worktree named `othername`, `npx vitest run test/smoke.test.tsx` passes, 167 tests.
- With the workspace set to another folder in `src/app.tsx`, the case fails.
- In the same worktree, `npm run typecheck`, `npm run build` and `npx vitest run` pass, 851 tests.

## Departures from the plan

- None.
