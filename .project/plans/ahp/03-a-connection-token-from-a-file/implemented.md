---
title: Read the connection token from the file the host keeps it in - implemented
date: 2026-09-24
refs:
  - "[code://src/config.ts](../../../../src/config.ts)"
  - "[code://test/cli.test.ts](../../../../test/cli.test.ts)"
---

`--connection-token-file <p>` names a file to read the connection token from, in the screen and the shell alike, and `connectionTokenFile` says the same in the config file.
It is the other end of `ahpd --connection-token-file`, which writes a fresh secret at `0600` when the file is absent, and the two were verified against each other rather than against a fixture.

## What was built

- `code://src/config.ts` - `connectionTokenFile` on `Config`, and `connectionToken(said, file)`, which both front ends now call instead of each keeping its own copy of the order: flag token, flag file, `AHPC_TOKEN`, config file path, config token. `readTokenFile` trims what it reads, refuses a missing or empty file, and never creates one.
- `code://src/cli/main.ts` - the flag in `where`, a help line, and a `Fault` so a refusal is a sentence rather than a stack.
- `code://src/tui.tsx` - the flag on its options and in its parse arms, a usage line, and the same call.

## Verified

- `code://test/cli.test.ts` - 5 cases: the file read as the host writes it, the two flags refused together, a missing and an empty file refused with nothing created, the order taken most-deliberate-first, and the flag parsed and documented by both front ends while staying out of `SWITCHES`.
- By hand against a running host. `ahpd --port 9187 --connection-token-file <p>` wrote `<p>` at `0600` holding a 32-character token and logged `token: written to <p>`. `ahpc status --host ws://127.0.0.1:9187 --connection-token-file <p>` answered `connected` and listed sessions. A file holding a different token, and no token at all, were both refused by that host, which is what makes the success meaningful.
- `npm test` - 31 files, 594 tests, green. `npm run typecheck` green.

## Departures from the plan

- None in behaviour. The plan was written after the change was made and verified, because the change was one flag and the host's half already existed.

## Left for later

- A refusal in the screen prints a stack rather than a sentence: the screen has no `Fault` handling, and `loadConfig` has always behaved that way there. Giving the screen its own error surface is its own change.
- A rejected connection token is reported as `Could not reach ws://...: TransportError: websocket failed to open`, the same sentence an unreachable port gets. Recorded in [finding a host without being told](../../../ideas/finding-a-host-without-being-told.md).
- Nothing discovers a host or its credential on its own; both are still typed. That is the idea above, and it needs the host's half too.
