---
title: A refusal is printed as a sentence
status: implemented
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

**Files**

- `src/cli/main.ts` - the catch, after the `-32007` branch. An error with a numeric `code` becomes `new Fault(`${message} (${code})`)`; one without a code is rethrown as it is, because no code means the host did not refuse anything and this client went wrong instead.
- `src/main.tsx` - the top level, which is where the stack used to be printed unconditionally. It now prints the sentence, and the stack under `AHPC_DEBUG=1`. The task's Files list names only `src/cli/main.ts`, but step 2 is this file and there is nowhere else it happens.
- `src/ahp/fake.ts` - **outside the task's Files list, and the one change here worth arguing with.** `disposeSession` of a session the script never had was silent, and printed `Disposed <uri>.` as though it had closed something. It now throws `-32001`, which is what `SessionNotFound` is declared to mean and what a real host answers. Without it there is no way to reach the new branch from a command at all: the only coded refusals the script makes are `-32007` (handled before this branch), `-32009` and `-32602`, and none of the three is on a path `cli` walks. That is why the task's own validation, "a fake host answering `-32001`", could not be run otherwise. Revert it and the branch goes back to being untested; nothing else here depends on it.
- `test/cli.test.ts` - the tests.

**Tests** (27 in the file, three new)

Through `cli()` against the script, hermetic as the chat tests above: `session rm ahp-session:/not-a-session` rejects with a `Fault` reading `No session at ahp-session:/not-a-session (-32001)` on one line; `chat rm ahp-chat:/1f0a` rejects with a plain error, `stack` and all, because the script refuses that one with no code and a client's own mistake must not be dressed as a refusal.

The entry point is driven by importing `src/main.tsx` rather than by running the binary: `dist` is not here, and a test that built the whole client to check three lines would be a test about the build. Each run gets a throwaway config directory, `process.argv` set to a command that fails against the script, `process.stderr.write` caught, and `process.exitCode` restored, since the module sets it to 1 by design. `vi.resetModules()` between runs, because importing it runs it and the second run would be answered from the cache. Three cases: no `AHPC_DEBUG` (one line, no stack), `AHPC_DEBUG=''` (still no stack - what it reads is `1`, not the presence of a name), and `AHPC_DEBUG=1` (the stack).

**Not done:** `AHPC_DEBUG` is undocumented. `README.md:314` is a table of the flags and variables this reads and the new one is not in it, because no task named that file. It wants a row: `| AHPC_DEBUG=1 | Print the stack when this client goes wrong |`.

`npm run typecheck` clean, `test/cli.test.ts` 27 passing, `npm test` 668 of 669 - the one failure is `test/smoke.test.tsx:1625` and is the same pre-existing one as in task 01.

Both of the plan's final verification lines that need a real ahpd are unrun: there is no host to point this at. The first two checklist items are checked here instead, against the script.

