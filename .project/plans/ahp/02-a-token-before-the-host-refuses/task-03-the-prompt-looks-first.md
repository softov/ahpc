---
title: The prompt looks for a token before it asks, and keeps the one the host takes
status: todo
depends: [task-01-the-chain-and-the-file.md]
layer: "src/control.ts"
refs:
  - "[code://src/control.ts#L498-L512](../../../../src/control.ts#L498-L512) - `askSignIn`, which pushes a waiter and opens the layer with nothing consulted first"
  - "[code://src/control.ts#L524-L541](../../../../src/control.ts#L524-L541) - `signIn`, where an accepted credential settles the waiters and a refused one keeps the prompt open"
  - "[code://src/control.ts#L486-L496](../../../../src/control.ts#L486-L496) - `settle` and its re-entrancy guard, which a silent resolution must go through rather than around"
  - "[code://test/auth.test.tsx](../../../../test/auth.test.tsx) - the six cases that describe the prompt's whole loop today"
---

## Objective

A refusal for a resource this machine already has a token for is answered without the person seeing anything, and the refused act runs once more exactly as it does now.
A token the person types and the host accepts is remembered, so the next run does not ask again.

## Steps

1. In `askSignIn`, before the layer is opened, resolve a token for the ask's resource through `resolveToken`. When one is found, push it and settle the waiters with it, drawing nothing.
2. A silently resolved token the host **refuses** falls through to the prompt rather than failing the act, and the entry is dropped with `forgetToken`. This is the stale-token case decision [a-token-is-kept-in-a-file-of-its-own](../../../decisions/a-token-is-kept-in-a-file-of-its-own.md) names, and the person is asked exactly as if nothing had been stored.
3. Resolve at most once per ask. A resolved token that fails must not be retried from the file on the next refusal in the same breath, or a stale entry becomes a loop.
4. In `signIn`, call `rememberToken` only after `host.authenticate` has resolved, never before and never on the catch path.
5. Everything settles through the existing `settle`, including the silent path, so the waiter list and the re-entrancy guard keep the meaning they have. Do not add a second way to answer a waiter.
6. `dismissSignIn` writes nothing, because nothing was accepted.

## Validation

- `test/auth.test.tsx` gains: a refusal with a token in the environment draws no prompt and serves the act once more; a refusal with a token in the file does the same; a stored token the host refuses opens the prompt and leaves no entry behind; a typed token the host accepts is in the file afterwards; a refused typed token is not.
- The six existing cases pass unchanged, with a temporary `XDG_CONFIG_HOME` and no `AHPC_TOKEN_*` set, which is what proves the prompt still opens when nothing is stored.
- `npm test` and `npm run typecheck` green.

## Resume
