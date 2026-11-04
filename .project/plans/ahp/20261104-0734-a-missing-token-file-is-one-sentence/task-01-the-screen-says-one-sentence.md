---
title: The screen says one sentence
status: implemented
depends: []
layer: "ahp"
refs:
  - "[code://src/tui.tsx#L362-L379](../../../../src/tui.tsx#L362-L379) - `tui` reads the token"
  - "[code://src/main.tsx#L46-L75](../../../../src/main.tsx#L46-L75) - the `Fault` catch around `cli()`"
---

## Objective

A throw from `connectionToken` in `tui` prints one line on stderr and exits 1, with no stack.

## Files

- `UPDATE: src/tui.tsx:362-379` - turn a throw from `connectionToken` into one line and exit code 1
- `UPDATE: test/cli.test.ts` - the case in *Validation*

## Steps

1. Catch a throw from `connectionToken` in `tui`.
2. Write its message as one line on stderr.
3. Set exit code 1, and return before the renderer starts.
4. Add the case in *Validation*.

## Validation

- `ahpc --connection-token-file /absent` with no command prints one line that names the path, and no stack.
- A config file with a missing `connectionTokenFile` and no host stops the start with the same line.
- `--token` with `--connection-token-file` prints the "not both" line on the screen path too.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
