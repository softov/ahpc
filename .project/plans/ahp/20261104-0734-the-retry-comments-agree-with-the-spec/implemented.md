---
title: The comments on a refused act agree with the spec, and a retry is tested - implemented
date: 2026-11-04
refs:
  - git://4f2558b
  - "[code://src/cli/main.ts](../../../../src/cli/main.ts)"
  - "[decision://one-accepted-credential-runs-the-act-again](../../decisions/one-accepted-credential-runs-the-act-again.md)"
  - "[code://test/auth.test.tsx](../../../../test/auth.test.tsx)"
---

The screen still runs a refused act once more after a credential the host accepted. The shell's comment now gives its real reason for not retrying: it has nobody to ask, and an exported variable is pushed on every connection. The decision says every awaited act may run once more, and cites the spec's `AuthRequired Error Code` section. A test now covers `createSession`.

## What was built

- [`code://src/cli/main.ts#L947-L956`](../../../../src/cli/main.ts#L947-L956) - the refusal comment names the shell's real reason.
- [`.project/decisions/one-accepted-credential-runs-the-act-again.md`](../../decisions/one-accepted-credential-runs-the-act-again.md) - every awaited act may run once more, with the spec as the source.
- [`code://test/auth.test.tsx`](../../../../test/auth.test.tsx) - a refused `createSession` gets one `authenticate` and one more call, and one session exists.

## Verified

- `npm run -s typecheck` passed.
- `npm run -s build` passed.
- `npx vitest run` passed 859 of 860 tests. The one failure is `test/smoke.test.tsx` "puts where the session runs on a row of its own". That is the known worktree failure, because the folder is not named `ahpc`.
- With `guard` removed from `createSession`, the new case fails. The wrapper was restored and the gates rerun.

## Departures from the plan

- none.

## Left for later

- none.
