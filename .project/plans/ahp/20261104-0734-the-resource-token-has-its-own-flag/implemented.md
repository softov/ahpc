---
title: The resource token has its own flag, and --token always means the connection - implemented
date: 2026-11-04
refs:
  - git://fa2b809
  - "[code://src/cli/main.ts](../../../../src/cli/main.ts)"
---

`ahpc auth <resource>` now takes its resource token from `--resource-token`, and `--token` is the connection token in every command.
A run that gives `--token` and no resource token stops with a sentence that names the right flag, and pushes nothing.

## What was built

- [`code://src/cli/main.ts`](../../../../src/cli/main.ts) - `signIn` reads `--resource-token`, then `AHPC_TOKEN_<RESOURCE>`, then a pipe, and refuses a lone `--token`; the `auth` help line names the new flag.
- [`code://docs/start/CONNECT.md#L50-L55`](../../../../docs/start/CONNECT.md#L50-L55) - the protected-resources example uses `--resource-token`.
- [`code://test/tokens.test.ts`](../../../../test/tokens.test.ts) - the three Validation cases, and a fourth: `--token` with `AHPC_TOKEN_<RESOURCE>` set pushes the variable's token.

## Verified

- `npm run -s typecheck` passed.
- `npm run -s build` passed.
- `npx vitest run` passed 853 of 854 tests. The one failure is `test/smoke.test.tsx` "puts where the session runs on a row of its own". That is the known worktree failure, because the folder is not named `ahpc`.

## Departures from the plan

- The refusal comes only when no resource token is found, from the flag, the variable or a pipe. The first build refused `--token` whenever `--resource-token` was absent, which also refused a run whose variable held the resource token. The fix was made in review.
- The pipe is read only when the flag and the variable give no token, as before. A script with an open stdin does not wait on it.

## Left for later

- `needsToken` still tells a person to pass `--token` for a resource. Plan `ahp/20261104-0734-a-refused-command-names-the-variable` changes it.
