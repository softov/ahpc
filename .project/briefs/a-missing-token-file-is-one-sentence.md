---
title: A missing connection token file is one sentence on the screen
created: 2026-11-04
replaces:
  - problems/a-bad-token-file-prints-a-stack-in-the-screen.md
refs:
  - git://3bcf162 - the commit of this repository the facts were checked at, and the last commit that holds the problem
  - "[code://src/tui.tsx#L362-L379](../../src/tui.tsx#L362-L379) - `tui` calls `connectionToken` with no `try` around it"
  - "[code://src/main.tsx#L46-L75](../../src/main.tsx#L46-L75) - the `Fault` catch wraps `cli()` and not `tui()`"
  - "[code://src/config.ts#L147-L182](../../src/config.ts#L147-L182) - `connectionToken` and `readTokenFile`, which throw"
  - "[code://src/cli/main.ts#L246-L258](../../src/cli/main.ts#L246-L258) - `where`, which turns the same throw into a `Fault`"
---

# A missing connection token file is one sentence on the screen

A connection token file that is named and cannot be read stops `ahpc` at start with one sentence, on the screen as in the shell.
Today the screen prints a stack trace for it.
Softov, 2026-11-04: "Always fail", also when no host is set and the scripted host would answer.

## What others do

- The shell already does this: `where` turns the throw from `connectionToken` into a `Fault`, and `src/main.tsx` prints a `Fault` as one line.

## What ahpc has today

- `tui` calls `connectionToken` on every start, with no `try` ([`code://src/tui.tsx#L362-L379`](../../src/tui.tsx#L362-L379)).
- `src/main.tsx` catches a `Fault` around `cli()` only, so a throw in `tui()` prints a stack ([`code://src/main.tsx#L46-L75`](../../src/main.tsx#L46-L75)).
- `connectionToken` reads `--connection-token-file`, or the config file's `connectionTokenFile` ([`code://src/config.ts#L147-L182`](../../src/config.ts#L147-L182)).

## Who writes

- `/github/ahpc` is on `main` at `3bcf162`, and no pull request is open.
- The branch `screen/20261104-0644-the-smoke-test-reads-its-folder` changes only `test/smoke.test.tsx`.
- [a-token-file-read-says-why-it-failed.md](a-token-file-read-says-why-it-failed.md) changes `readTokenFile` in `src/config.ts`. The two changes touch other functions.

## The change

- A token file that cannot be read stops the screen at start with one sentence on stderr, and exit code 1.
- The rule is the same with and without a host: a named file that cannot be read always stops the start.
- A test starts the screen with a missing token file, and reads one line and no stack.
