---
title: A command a host refuses names the variable that would let it through - implemented
date: 2026-11-04
refs:
  - git://ffe7176
  - "[code://src/cli/main.ts](../../../../src/cli/main.ts)"
  - "[code://src/connect.ts#L70-L76](../../../../src/connect.ts#L70-L76)"
---

A command the host refuses with `-32007` now says "<what> needs a token. Set AHPC_TOKEN_<RESOURCE> and run it again." `ahpc auth` keeps its own sentence, naming `--resource-token`, the variable and a pipe. The no-screen ask names the variable too, and keeps "has expired" for an expired token.

## What was built

- [`code://src/cli/main.ts`](../../../../src/cli/main.ts) - `refusedSentence` for the refusal catch; `needsToken` names `--resource-token`, the variable and a pipe.
- [`code://src/connect.ts#L70-L76`](../../../../src/connect.ts#L70-L76) - `signInSentence` names the variable rather than `ahpc auth`, and keeps "has expired".
- [`code://test/auth.test.ts`](../../../../test/auth.test.ts) - the three Validation cases and the updated `needsToken` wording.

## Verified

- `npm run -s typecheck` passed.
- `npm run -s build` passed.
- `npx vitest run` passed 858 of 859 tests. The one failure is `test/smoke.test.tsx` "puts where the session runs on a row of its own". That is the known worktree failure, because the folder is not named `ahpc`.

## Departures from the plan

- `src/connect.ts` line 6 gained `tokenVariable` in the existing import from `./ahp/tokens.js`. The file was limited to lines 71-89, and `signInSentence` cannot name the variable without that import. Nothing in lines 135-158 changed.
- `needsToken` no longer ends with `ahpc auth <resource>`, because `ahpc auth` itself prints it.
- A sign-in ask that is not expired says "needs a token", as the refused command does, in place of "needs signing in to".
- An expired ask says to set the variable "to a new token". The spec says the challenged token is not sent again. The wording was set in review.

## Left for later

- none.
