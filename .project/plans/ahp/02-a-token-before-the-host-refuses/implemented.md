---
title: Push a token before the host refuses, and look for one before asking - implemented
date: 2026-09-26
refs:
  - "[code://src/ahp/tokens.ts](../../../../src/ahp/tokens.ts)"
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts)"
  - "[code://src/connect.ts](../../../../src/connect.ts)"
  - "[code://src/control.ts](../../../../src/control.ts)"
  - "[code://test/tokens.test.ts](../../../../test/tokens.test.ts)"
  - "[code://test/reconnect.test.ts](../../../../test/reconnect.test.ts)"
  - "[code://test/auth.test.tsx](../../../../test/auth.test.tsx)"
---

A resource token comes from `AHPC_TOKEN_<RESOURCE>` or from a cache that lives as long as the process, is pushed for every declared resource on every connection including a remade one, and is tried before the sign-in prompt is drawn.
Nothing is written to disk and no environment variable is set.

## What was built

- `code://src/ahp/tokens.ts` - `tokenVariable`, moved from the shell; `resolveToken`, variable first and cache second; `remember`; `forget(resource, error)`, which drops an entry only on a `-32007`; `pushTokens`, the silent push; `forgetAll`, for tests.
- `code://src/ahp/live.ts` - `onConnected` on `LiveHostOptions`, awaited before `liveHost` returns and after each reconnect's resume, before the catalogue is reread. A throw is swallowed.
- `code://src/connect.ts` - answers `onConnected` with `pushTokens`. The shell's one-shot commands get the push too, since they connect through the same function.
- `code://src/control.ts` - `askSignIn` tries `silently` first, then draws the prompt; `signIn` remembers a token after the host takes it.
- `code://src/cli/main.ts` - imports `tokenVariable` instead of keeping its own.

## Verified

- `code://test/tokens.test.ts` - 8 cases: the name, the order, the cache, forgetting on `-32007` and not on `-32602` or a dropped link, the push and its skips, and nothing under a temporary `XDG_CONFIG_HOME`.
- `code://test/reconnect.test.ts` - 3 cases over the scripted transport: pushed before `liveHost` returns and again after a forced drop, nothing for a host that declares nothing, nothing for a resource with no token. The reconnect case fails with the push removed from the loop.
- `code://test/auth.test.tsx` - 5 cases: a typed token kept only when accepted; an exported token answers a refusal with no prompt; a token signed in with earlier answers a later refusal; a cached token the host no longer knows opens the prompt and is dropped; an `expired` challenge never replays. Three fail with the silent path removed.
- `npm test` - 32 files, 636 tests, green. `npx tsc` green.
- Not run against a live `ahpd`.

## Departures from the plan

- Task 03 step 5 said the silent path settles through `settle`. It returns `true` to `attempt` and adds no waiter instead, because `settle` answers every other waiter with no and closes the layer, so a silent sign-in for one resource would have dismissed a prompt open for another. `settle` is still the only way a waiter is answered.
- An `expired` challenge skips the look, which the plan did not say: `authentication.md` forbids replaying the challenged credential, and the cached one is the one that was challenged.
- `test/auth.test.tsx` gained a reset of the cache and of `AHPC_TOKEN_*` around each case. The existing case bodies are unchanged.

## Left for later

- The shell's refusal sentence, `needsToken` and `signInSentence`, still names `--token` and `ahpc auth X`, which do not carry a resource token into another command. The exported variable now works for every command. Launch finding 1.
