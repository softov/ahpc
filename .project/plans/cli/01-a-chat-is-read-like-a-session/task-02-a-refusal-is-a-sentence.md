---
title: A refusal is printed as a sentence
status: todo
depends: []
layer: "cli"
refs:
  - "[code://src/cli/main.ts#L780-L793](../../../../src/cli/main.ts#L780-L793) - the catch that rethrows every error but `-32007`"
  - "[code://src/cli/main.ts#L221](../../../../src/cli/main.ts#L221) - `Fault`"
---

## Objective

Any `RpcError` a command meets is printed as `<message> (<code>)` on stderr with exit 1, and the stack only when `AHPC_DEBUG=1`.

## Files

- `UPDATE: src/cli/main.ts` - the catch turns an `RpcError` into a `Fault`.
- `UPDATE: test/cli.test.ts`.

## Steps

1. After the `-32007` branch, an error with a numeric `code` becomes `new Fault(`${message} (${code})`)`.
2. Where the top level prints a non-`Fault`, print the stack only under `AHPC_DEBUG=1`.

## Validation

- A fake host answering `-32001`: stderr is one line naming the code, exit 1.
- With `AHPC_DEBUG=1`: the stack is printed.

## Resume

