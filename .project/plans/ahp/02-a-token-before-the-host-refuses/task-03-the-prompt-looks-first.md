---
title: The prompt looks for a token before it asks, and keeps the one the host takes
status: todo
depends: [task-01-the-chain-and-the-cache.md]
layer: "src/control.ts"
refs:
  - "[code://src/control.ts#L498-L512](../../../../src/control.ts#L498-L512) - `askSignIn`, which pushes a waiter and opens the layer with nothing consulted first"
  - "[code://src/control.ts#L524-L541](../../../../src/control.ts#L524-L541) - `signIn`, where an accepted credential settles the waiters and a refused one keeps the prompt open"
  - "[code://src/control.ts#L486-L496](../../../../src/control.ts#L486-L496) - `settle` and its re-entrancy guard, the one way a waiter is answered"
  - "[code://test/auth.test.tsx](../../../../test/auth.test.tsx) - the six cases describing the prompt's loop, which must keep passing untouched"
---

## Objective

A refusal for a resource this process already has a token for is answered without the person seeing anything, and the refused act runs once more exactly as it does now.
A token the person types and the host accepts is kept for the rest of the run, so the next refusal and the next reconnect cost nothing.

## Steps

1. In `askSignIn`, before the layer is opened, resolve a token for the ask's resource through `resolveToken`. When one is found, push it and settle the waiters with it, drawing nothing.
2. A resolved token the host **refuses** falls through to the prompt rather than failing the act, and the entry is dropped with `forget` under task 01's rule. The person is then asked exactly as if nothing had been cached.
3. Resolve at most once per ask, so a stale entry cannot become a loop between the refusal and the retry.
4. In `signIn`, call `remember` only after `host.authenticate` has resolved, never before and never on the catch path. A token the host turned down is a wrong token.
5. Everything settles through the existing `settle`, the silent path included, so the waiter list and the re-entrancy guard keep the meaning they have. Do not add a second way to answer a waiter.
6. `dismissSignIn` remembers nothing, because nothing was accepted.

## Validation

- `test/auth.test.tsx` gains: a refusal with a token in the environment draws no prompt and serves the act once more; a token cached by an earlier accepted sign-in does the same; a cached token the host refuses opens the prompt and leaves no entry behind; a typed token the host accepts is resolvable afterwards; a refused one is not.
- The six existing cases pass unchanged with no `AHPC_TOKEN_*` set, which is what proves the prompt still opens when nothing is cached.
- `npm test` and `npm run typecheck` green.

## Resume
