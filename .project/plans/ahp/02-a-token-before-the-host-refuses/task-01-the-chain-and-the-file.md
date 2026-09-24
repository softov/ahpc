---
title: A token is resolved from the environment and a file, and kept there once the host takes it
status: todo
depends: []
layer: "src/ahp"
refs:
  - "[code://src/config.ts#L65-L80](../../../../src/config.ts#L65-L80) - `configHome` and `statePath`, the XDG helpers and the rule that a program-written file sits beside `config.json` rather than inside it"
  - "[code://src/cli/main.ts#L1302-L1305](../../../../src/cli/main.ts#L1302-L1305) - the chain the shell resolves today, which this task moves behind one function without changing what it does"
  - "[code://src/cli/main.ts#L1324-L1327](../../../../src/cli/main.ts#L1324-L1327) - `tokenVariable`, private today and needed by the screen from here on"
  - "[code://src/ahp/auth.ts](../../../../src/ahp/auth.ts) - the sibling module: the reading and the rule, with no renderer, no store and no socket"
  - file:///home/softov/projects/ahpx/src/auth/handler.ts#L188-L233 - `storeToken` and `loadToken`, the 0600 write through a temporary file and a rename, and the corrupt-file behaviour
---

## Objective

One module resolves a token for a resource from `AHPC_TOKEN_<RESOURCE>` and then from this client's own token file, and writes one back when a host has accepted it.
Nothing draws, connects or prompts here, and the shell's existing chain is expressed through it rather than duplicated.

## Files

- `CREATE: src/ahp/tokens.ts` - `tokenVariable`, `resolveToken`, `rememberToken`, `forgetToken`, and the path the file lives at.
- `UPDATE: src/cli/main.ts:1302-1305` - `signIn` resolves `--token` itself and asks this module for the rest, so the shell and the screen read the same two sources in the same order.
- `UPDATE: src/cli/main.ts:1324-1327` - `tokenVariable` moves to the new module and is imported back, because the screen needs it and `src/cli/` is not something `src/control.ts` may import.
- `CREATE: test/tokens.test.ts` - the chain, the file, the permissions and the corrupt file.

## Steps

1. Move `tokenVariable` into `src/ahp/tokens.ts` unchanged, and import it in `src/cli/main.ts`. Its derivation is already covered by `test/auth.test.ts` through `needsToken`, so that test must stay green without edits.
2. Write the token file's path as `statePath('ahpc', 'tokens.json')`, never `configPath`, for the reason decision [a-token-is-kept-in-a-file-of-its-own](../../../decisions/a-token-is-kept-in-a-file-of-its-own.md) gives and the superseded decision gave before it.
3. `resolveToken(resource)` reads `process.env[tokenVariable(resource)]` first and the file second, and answers `undefined` when neither has one. It never prompts and never throws.
4. `rememberToken(resource, token)` writes the file at 0600 through a temporary file and a rename, creating the directory at 0700. A write that fails is not an error the caller has to handle: a token that could not be saved is still a token the host took.
5. `forgetToken(resource)` drops one entry, for the credential a host turns down. Decision [a-token-is-kept-in-a-file-of-its-own](../../../decisions/a-token-is-kept-in-a-file-of-its-own.md) names a stale token as the new failure this introduces, and this is what answers it.
6. A file that is not there is not an error and a file that is corrupt is not either: it is reported through the same `sink` a connection uses and treated as empty, because refusing to start over an unreadable cache would be worse than asking for the token again.

## Validation

- `test/tokens.test.ts`: the variable wins over the file; the file answers when the variable is unset; neither gives `undefined`; a written file is 0600 and its directory 0700; a remembered token reads back; a forgotten one does not; a corrupt file reads as empty and says so once.
- Every test writes under a temporary `XDG_CONFIG_HOME` and never touches the real one.
- `npm test` and `npm run typecheck` green.

## Resume
