---
title: A failed turn prints its error
status: done
depends: []
layer: "cli, mcp"
refs:
  - "[code://src/wait.ts#L64-L67](../../../../src/wait.ts#L64-L67) - `spoken`, which drops an error part"
  - "[code://src/cli/main.ts#L1484-L1502](../../../../src/cli/main.ts#L1484-L1502) - `prompt` and `exec`"
  - "[code://src/cli/main.ts#L918-L933](../../../../src/cli/main.ts#L918-L933) - `session show`"
  - "[code://src/mcp/tools.ts#L90-L96](../../../../src/mcp/tools.ts#L90-L96) - `said`"
  - "[code://test/failure.test.ts](../../../../test/failure.test.ts) - the five cases"
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
- `CREATE: test/failure.test.ts` - the five cases below.

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

Built on 2026-10-07. `test/failure.test.ts` holds all five cases, and they pass.

The plan's three Files entries for the CLI and the tool server each landed as written.
`failure(turn)` is a `flatMap` over the error parts. It drops a message that is empty, so a host that names no reason prints no blank line.

The prompt test could not be written the way the plan assumed, and this is the one thing it did not know.
The scripted host's time is a `pump`, and only the screen drives one, from a ticker.
A shell run drives none, so `cli('prompt', ...)` waits for a turn that never takes a step and then times out.
So `test/failure.test.ts` replaces `../src/connect.js` with a `connect` that hands back a `fakeHost()` the test pumps itself.
Every other module in that path is the real one, and no production file changed for it.
A second reading of the same problem is to make `cli()` drive the pump of the host it built. That is a behaviour change the plan does not name, so it was not taken.
The user was asked to choose and the question could not be put, so the smaller option was taken and it is recorded here.

The error message of the scripted `fail` turn is a new option on `finish`, not a new helper.
A turn is `failed` and carries the host's sentence only when `finish` writes both. That is what makes the fixture honest about a turn that stopped.

`session show` reads the turns through `snapshot`, because `detail` carries none.
It subscribes only where the status is `error`, so a command a person runs on a session that is fine costs no subscription.
