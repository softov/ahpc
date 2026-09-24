---
title: A resource token is resolved from the environment and a process-lifetime cache
status: todo
depends: []
layer: "src/ahp"
refs:
  - "[code://src/cli/main.ts#L1302-L1305](../../../../src/cli/main.ts#L1302-L1305) - the chain the shell resolves today, which this task expresses once rather than twice"
  - "[code://src/cli/main.ts#L1324-L1327](../../../../src/cli/main.ts#L1324-L1327) - `tokenVariable`, private today and needed by the screen from here on"
  - "[code://src/cli/main.ts#L229](../../../../src/cli/main.ts#L229) - the *connection* token, which this module must not touch or resolve"
  - "[code://src/ahp/auth.ts#L87-L109](../../../../src/ahp/auth.ts#L87-L109) - `authRequiredOf`, the reader that tells a bad credential from a bad request"
  - "[code://src/ahp/auth.ts](../../../../src/ahp/auth.ts) - the sibling module: the reading and the rule, with no renderer, no store and no socket"
---

## Objective

One module answers "a resource token for this, or nothing" from `AHPC_TOKEN_<RESOURCE>` and then from a cache that lives as long as the process, and takes one back when a host says the credential is not one it knows.
Nothing is written to disk, nothing draws, nothing connects.

## Files

- `CREATE: src/ahp/tokens.ts` - `tokenVariable`, `resolveToken`, `remember`, `forget`, and the private map behind them.
- `UPDATE: src/cli/main.ts:1324-1327` - `tokenVariable` moves to the new module and is imported back, because the screen needs it and `src/control.ts` may not import `src/cli/`.
- `CREATE: test/tokens.test.ts` - the order, the cache, the forgetting, and the two failures told apart.

## Steps

1. Move `tokenVariable` into `src/ahp/tokens.ts` unchanged and import it back in `src/cli/main.ts`. Its derivation is covered through `needsToken` in `test/auth.test.ts`, which must stay green without edits.
2. Hold the cache in a module-private `Map`, never in the reactive store. Decision [a-token-is-kept-for-the-process-and-never-written-down](../../../decisions/a-token-is-kept-for-the-process-and-never-written-down.md) keeps the superseded reasoning about a secret every screen binds to.
3. `resolveToken(resource)` reads `process.env[tokenVariable(resource)]` first and the cache second, and answers `undefined` when neither has one. It never prompts and never throws.
4. `remember(resource, token)` is called only by a caller that has seen `authenticate` resolve. This module does not decide when a credential was accepted.
5. `forget(resource)` drops one entry. Give it the shape callers need to apply the rule in step 6 rather than making each one reimplement it, which is what a second reading of the same error would become.
6. The rule for dropping one is an **authentication** failure and not any failure: `authRequiredOf(error)` non-null means the host does not know the credential, and anything else is a wrong resource (`-32602`), a dropped link, or a host fault, none of which say the token is bad.
7. Write nothing to disk and set no environment variable, in this module or anywhere this plan touches. Both are the decision, and the second is why: a session spawns child processes that inherit this client's environment.

## Validation

- `test/tokens.test.ts`: the variable wins over the cache; the cache answers when the variable is unset; neither gives `undefined`; a remembered token reads back; a forgotten one does not; a `-32007` is classified as forgettable and a `-32602`, a generic `Error` and a network-shaped rejection are not.
- A test that asserts nothing is written: no file appears under a temporary `XDG_CONFIG_HOME` across a resolve, a remember and a forget.
- `npm test` and `npm run typecheck` green.

## Resume
