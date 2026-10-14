---
title: A timeout says the turn still runs
status: implemented
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

## Resume

`prompt` writes `Stopped waiting after N seconds. The turn is still running.` on stderr when `run` returns `undefined`.
N is the `--timeout` value, and the default is 900.
The line is written in every mode, and `--json` still prints `{ state: 'timeout' }` on stdout.
The exit code stays 1, which is what a turn that did not complete returns.
`test/busy.test.ts` holds one case that runs the same turn twice, once plain and once with `--json`.

What the plan did not know.
The sentence has no singular form, so a wait of one second reads `Stopped waiting after 1 seconds.`
The shell may already have written `  · waiting on <tool>` to the same stderr, so the test reads the lines that start with `Stopped waiting`.
Nothing else on stderr changes, and a caller that got an answer sees no line at all.
The MCP tool needs no line: it has always answered `{ state: 'timeout' }` to a program.
`npm run typecheck` is clean, and the typed suite passes apart from the one `test/smoke.test.tsx` failure this worktree already had.
