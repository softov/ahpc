---
title: "--token means the resource token in ahpc auth and the connection token everywhere else"
status: open
date: 2026-09-26
severity: major
refs:
  - "[code://src/cli/main.ts#L1314](../../src/cli/main.ts#L1314) - `signIn`, which reads `--token` as the credential for the resource"
  - "[code://src/config.ts#L136-L157](../../src/config.ts#L136-L157) - `connectionToken`, which reads the same flag as the credential for the socket"
  - "[review/2026-09-26-before-launch.md](../review/2026-09-26-before-launch.md) - finding 2"
  - "[decisions/the-client-reads-a-token-file-and-never-writes-one.md](../decisions/the-client-reads-a-token-file-and-never-writes-one.md) - the mutual exclusion that makes the collision visible"
---

## Symptom

`ahpc auth <RESOURCE> --token T --connection-token-file F` fails with `Pass --token or --connection-token-file, not both.`
The two flags are not about the same secret: `T` is the resource credential being pushed and `F` holds the connection token, so there is no conflict to report.
Without the file flag, `T` is read as the connection token as well, and replaces whatever the config file or the environment had.

## Cause

One flag name for two credentials.
`signIn` reads `--token` as the resource token; `where()` resolves the connection token from the same flag before the command runs.
Plan ahp/03's mutual exclusion is correct for the connection token and turns the pre-existing overlap into a refusal.

## Impact

`ahpc auth` cannot be used on a host that needs a connection token file.
Anyone using `--token` for a resource is silently changing which credential opens the socket.

## Workaround

Push the resource token by a pipe or `AHPC_TOKEN_<RESOURCE>` instead of `--token`, and leave `--token` for the connection.

## Fix

Give the resource token its own flag and leave `--token` meaning the connection.
The plan that does it has to keep the old spelling working or say that it does not.
