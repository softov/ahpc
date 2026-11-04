---
title: The resource token has its own flag, and --token always means the connection
created: 2026-11-04
replaces:
  - problems/token-means-two-things-in-ahpc-auth.md
refs:
  - git://3bcf162 - the commit of this repository the facts were checked at, and the last commit that holds the problem
  - "[code://src/cli/main.ts#L1584-L1589](../../src/cli/main.ts#L1584-L1589) - `ahpc auth` reads `--token` as the resource token"
  - "[code://src/cli/main.ts#L246-L258](../../src/cli/main.ts#L246-L258) - `where` reads the same `--token` as the connection token, before the command runs"
  - "[code://src/config.ts#L147-L158](../../src/config.ts#L147-L158) - `--token` and `--connection-token-file` are refused together"
  - "[code://src/flags.ts](../../src/flags.ts) - the one table of flags that take a value"
  - file:///github/ahpd/packages/server/src/commands/options.ts - at ahpd `4d703f16`, ahpd's `--token` is the credential that opens the connection
---

# The resource token has its own flag, and --token always means the connection

`ahpc auth <resource> --resource-token T` pushes the token for a resource.
`--token` means the connection token in every command, as in ahpd.
Softov, 2026-11-04: "New --resource-token".

## What others do

- ahpd's `--token` is the credential that opens the connection, and ahpd has no other meaning for it.

## What ahpc has today

- `ahpc auth` reads `--token` as the resource token ([`code://src/cli/main.ts#L1584-L1589`](../../src/cli/main.ts#L1584-L1589)).
- `where` reads the same `--token` as the connection token before the command runs ([`code://src/cli/main.ts#L246-L258`](../../src/cli/main.ts#L246-L258)).
- So `ahpc auth X --token T --connection-token-file F` is refused with `Pass --token or --connection-token-file, not both.`
- Without the file flag, `T` also replaces the connection token.

## Who writes

- `/github/ahpc` is on `main` at `3bcf162`, and no pull request is open.
- [a-refused-command-names-the-variable.md](a-refused-command-names-the-variable.md) changes the sentences in the same function. The two briefs are planned together or one after the other.

## The change

- `ahpc auth <resource>` takes the resource token from `--resource-token`, `AHPC_TOKEN_<RESOURCE>` or a pipe.
- `--token` is the connection token in `ahpc auth` too.
- `ahpc auth <resource> --token T` with no `--resource-token` stops with a sentence that names `--resource-token`. The old form does not work any more.
- `--resource-token` is in the table of flags that take a value, and in the help and the docs.
- A test covers the new flag, the old form's sentence, and `--resource-token` with `--connection-token-file`.
