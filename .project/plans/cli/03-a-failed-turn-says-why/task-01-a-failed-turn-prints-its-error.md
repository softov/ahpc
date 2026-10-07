---
title: A failed turn prints its error
status: todo
depends: []
layer: "cli, mcp"
refs:
  - "[code://src/wait.ts#L64-L67](../../../../src/wait.ts#L64-L67) - `spoken`"
  - "[code://src/cli/main.ts#L1484-L1502](../../../../src/cli/main.ts#L1484-L1502) - `prompt` and `exec`"
  - "[code://src/cli/main.ts#L918-L933](../../../../src/cli/main.ts#L918-L933) - `session show`"
  - "[code://src/mcp/tools.ts#L90-L96](../../../../src/mcp/tools.ts#L90-L96) - `said`"
---

## Objective

A failed turn's message reaches the person.
`prompt` and `exec` write it on stderr, the MCP tools return it as `error`, and `session show` prints it in an `Error` row.

## Files

- `UPDATE: src/wait.ts:64-67` - add `failure(turn)`, which returns the messages of the turn's error parts. `spoken` stays as it is.
- `UPDATE: src/cli/main.ts:1484-1502` - after a turn that is not complete, write each message from `failure` to stderr. The exit code stays 1.
- `UPDATE: src/cli/main.ts:918-933` - when the status is error, add an `Error` row with the last turn's error message.
- `UPDATE: src/mcp/tools.ts:90-96` - `said` adds `error` when `failure` returns a message.
- `UPDATE: src/ahp/fake.ts` - a scripted turn can end in an error part, if it cannot already.

## Steps

1. Write the tests first, against the fake host.
2. Add `failure` and use it in the three places.
3. Every string a person reads is the host's own sentence. Add no prefix and no internals.

## Validation

- A test: a fake turn ends in an error part. `prompt` writes the message to stderr and returns 1.
- The same test: stdout has only the text before the error.
- A test: `said()` has `error` with the message.
- A test: `session show` prints the `Error` row.
- The repo's typecheck and full test run pass.

## Resume
