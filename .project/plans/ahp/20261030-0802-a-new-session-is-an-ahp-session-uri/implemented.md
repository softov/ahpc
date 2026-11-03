---
title: A new session is an `ahp-session:` URI - implemented
date: 2026-10-30
refs:
  - git://97a6341
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts)"
  - "[code://src/links.ts](../../../../src/links.ts)"
  - "[code://test/scenario.test.ts](../../../../test/scenario.test.ts)"
---

A session ahpc creates is now named `ahp-session:/<uuid>`, which is the scheme the protocol and VS Code give it, with the provider in the `createSession` request rather than in the name. A session another client opened under `<provider>:/<id>` still opens, because the row a link names is matched on the id and the provider under either scheme.

## What was built

- `src/ahp/live.ts` - `createSession` sends and returns `ahp-session:/${randomUUID()}` as the channel, with `provider` still in the request beside it; the comment above it says the scheme names the kind of resource and not the provider.
- `src/links.ts` - the comment on `sessionOfLink` now says this client starts `ahp-session:/` and that an older client or host may have started `<provider>:/`; the match itself is unchanged.
- `test/scenario.test.ts` - the created session is expected to start with `ahp-session:/`, and a new case checks the request's `provider` and `channel` beside a full `ahp-session:/<uuid>` name.

## Verified

- `test/scenario.test.ts`: 5 tests green, including the new case for the request's `provider` and `channel`.
- `npm run typecheck`: clean.
- `npm test`: 817 tests, 816 passed. The one failure is `test/smoke.test.tsx > the composer is the front door > puts where the session runs on a row of its own`, which expects the checkout directory to be named `ahpc` and is at `build-agents-99b61ae4` in this worktree; the same test fails on `main` here, and nothing in this plan touches it.
- By hand against ahpd `main` on 2026-11-03: `session new` printed an `ahp-session:/` URI, and `session list` listed it under that URI.
- By hand on 2026-11-03: `exec` printed the answer, exited 0, and disposed its session.

## Departures from the plan

- none.

## Left for later

- None.
