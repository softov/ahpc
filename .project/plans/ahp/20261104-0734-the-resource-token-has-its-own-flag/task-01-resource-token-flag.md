---
title: The --resource-token flag
status: todo
depends: []
layer: "ahp"
refs:
  - "[code://src/cli/main.ts#L1584-L1589](../../../../src/cli/main.ts#L1584-L1589) - `ahpc auth` reads `--token`"
  - "[code://src/cli/main.ts#L120](../../../../src/cli/main.ts#L120) - the help line for `auth`"
---

## Objective

`ahpc auth` reads the resource token from `--resource-token`, and `--token` there is the connection token.

## Files

- `UPDATE: src/cli/main.ts:1584-1589` - read `--resource-token`, and refuse the old form with a sentence
- `UPDATE: src/cli/main.ts:120` - the help line names `--resource-token`
- `UPDATE: docs/start/CONNECT.md:50-54` - the example uses `--resource-token`
- `UPDATE: test/tokens.test.ts` - the cases in *Validation*

## Steps

1. Read the resource token from `--resource-token`, then `AHPC_TOKEN_<RESOURCE>`, then a pipe.
2. Stop with "--token is the connection token. Use --resource-token for this." when `--token` is the only token.
3. Change the help line for `auth` to `[--resource-token T]`.
4. Change the example in `docs/start/CONNECT.md`.
5. Add the cases in *Validation*.

## Validation

- `ahpc auth X --resource-token T` pushes `T` for `X`.
- `ahpc auth X --resource-token T --connection-token-file F` connects with the token in `F` and pushes `T`.
- `ahpc auth X --token T` stops with the sentence that names `--resource-token`, and pushes nothing.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
