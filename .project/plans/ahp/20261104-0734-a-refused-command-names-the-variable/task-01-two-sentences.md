---
title: Two sentences, one for each place
status: done
depends: []
layer: "ahp"
refs:
  - "[code://src/cli/main.ts#L981](../../../../src/cli/main.ts#L981) - the refusal catch"
  - "[code://src/cli/main.ts#L999-L1002](../../../../src/cli/main.ts#L999-L1002) - `needsToken`"
  - "[code://src/connect.ts#L71-L89](../../../../src/connect.ts#L71-L89) - `signInSentence`"
---

## Objective

A refused command and `ahpc auth` each say only the ways in that work there.

## Files

- `UPDATE: src/cli/main.ts:981-1002` - a sentence for a refused command, and one for `ahpc auth`
- `UPDATE: src/connect.ts:71-89` - `signInSentence` names the variable, not `ahpc auth`
- `UPDATE: test/auth.test.ts` - the cases in *Validation*

## Steps

1. Write `refusedSentence(resource, name)`: "<what> needs a token. Set AHPC_TOKEN_<RESOURCE> and run it again."
2. Use it in the refusal catch.
3. Keep `needsToken` for `ahpc auth`, with `--resource-token`, the variable and a pipe.
4. Make `signInSentence` name the variable, and keep "has expired" for an expired token.
5. Add the cases in *Validation*.

## Validation

- A `-32007` on `session list` prints the variable sentence, with no `--token` and no `ahpc auth`.
- `ahpc auth X` with no token prints the sentence with `--resource-token`.
- An expired ask with no screen prints "has expired" and the variable.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
