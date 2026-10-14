---
title: A timeout says the turn still runs
status: todo
depends: []
layer: cli
refs:
  - "[code://src/cli/main.ts#L1600-L1606](../../../../src/cli/main.ts#L1600-L1606) - `prompt`, which prints `{state:'timeout'}` only under `--json`"
---

## Objective

When `prompt` stops waiting before the turn ends, a person sees why.

## Files

- `UPDATE: src/cli/main.ts:1600-1606` - when `run` returns `undefined`, write one line on stderr in every mode. `--json` still prints `{state:'timeout'}` on stdout. The exit code stays 1.
- `UPDATE: test/busy.test.ts` - the timeout case.

## Steps

1. Write the test first, with a scripted turn that does not end and `--timeout 1`.
2. Write the line as one plain sentence: "Stopped waiting after N seconds. The turn is still running."

## Validation

- A test: `prompt --timeout 1` on a turn that does not end writes the line on stderr and returns 1.
- The same test with `--json`: stdout has `{state:'timeout'}`, and stderr has the line.
- `npm run typecheck` and `npx vitest run` pass.
