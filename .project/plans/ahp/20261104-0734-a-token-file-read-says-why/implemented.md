---
title: A token file that cannot be read says why, and its path is read the same from any folder - implemented
date: 2026-11-04
refs:
  - git://fa2b809
  - "[code://src/config.ts](../../../../src/config.ts)"
---

Each failure to read a connection token file now names its real reason. A `connectionTokenFile` path written in the config file is read from that file's folder, not from wherever ahpc was started. A leading `~/` means the home folder. A path given as `--connection-token-file` is still read exactly as the shell passed it.

## What was built

- [`code://src/config.ts`](../../../../src/config.ts) - `loadConfig` records the folder it read from, and `connectionToken` resolves a configured path against it. `readTokenFile` gives a sentence for a missing file, a permission failure, a folder and any other failure.
- [`code://test/cli.test.ts`](../../../../test/cli.test.ts) - the cases that pin those sentences and both path rules.

## Verified

- `npm run -s typecheck` and `npm run -s build` pass.
- `npx vitest run`: 855 of 856 pass. The one failure is `test/smoke.test.tsx` "puts where the session runs on a row of its own". It fails in this worktree because the folder is not named `ahpc`. A fix is on another branch.
- The connection token cases in `test/cli.test.ts`: 10 passed, including the five added here.

## Departures from the plan

- none.

## Left for later

- none.
