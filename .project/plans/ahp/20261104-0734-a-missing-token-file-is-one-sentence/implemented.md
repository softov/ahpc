---
title: A missing connection token file is one sentence on the screen - implemented
date: 2026-11-04
refs:
  - git://58bfe6f
  - "[code://src/tui.tsx](../../../../src/tui.tsx)"
---

A named connection token file that cannot be read now stops the screen at start. It writes one sentence on stderr, sets exit code 1 and starts no renderer, as the shell already does, instead of a stack trace. A config file that names a missing token file stops it the same way, and so does `--token` given with `--connection-token-file`.

## What was built

- [`code://src/tui.tsx`](../../../../src/tui.tsx) - `tui` turns a throw from `connectionToken` into one line on stderr, sets exit code 1 and returns before the renderer starts.
- [`code://test/cli.test.ts`](../../../../test/cli.test.ts) - the cases that pin that sentence and exit for the flag, the config file and the two-flag refusal.

## Verified

- `npm run -s typecheck` and `npm run -s build` pass.
- `npx vitest run`: 858 of 859 pass. The one failure is `test/smoke.test.tsx` "puts where the session runs on a row of its own". It fails in this worktree because the folder is not named `ahpc`. A fix is on another branch.
- The entry-point cases in `test/cli.test.ts`: 4 passed, including the three added here.

## Departures from the plan

- none.

## Left for later

- none.
