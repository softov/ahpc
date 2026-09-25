---
title: Both front ends take a connection token file and resolve it the same way
status: done
depends: []
layer: "src/config.ts, src/cli/main.ts, src/tui.tsx"
refs:
  - "[code://src/config.ts#L8-L30](../../../../src/config.ts#L8-L30) - `Config`, where the new key goes"
  - "[code://src/cli/main.ts#L226-L245](../../../../src/cli/main.ts#L226-L245) - `where`, the shell's half"
  - "[code://src/tui.tsx#L200-L215](../../../../src/tui.tsx#L200-L215) - the screen's flag arms, one line each"
---

## Objective

`--connection-token-file <p>` is read by the screen and the shell alike, resolved by one function, and documented in both usages.

## Files

- `UPDATE: src/config.ts` - `connectionTokenFile` on `Config`, plus `connectionToken` and `readTokenFile`.
- `UPDATE: src/cli/main.ts` - the flag in `where`, the help line, and a `Fault` for a refusal.
- `UPDATE: src/tui.tsx` - `tokenFile` on its options, the parse arm, the usage line, and the same call.
- `UPDATE: test/cli.test.ts` - five cases.

## Steps

1. Add `connectionTokenFile` to `Config`, documented as a path rather than a credential.
2. Write `connectionToken(said, file)`: refuse `--token` and `--connection-token-file` together, then flag token, flag file, `AHPC_TOKEN`, config file path, config token.
3. Write `readTokenFile`: trim what is read, refuse a missing file with a sentence naming the host's flag, refuse an empty one, and never create it. Decision [the-client-reads-a-token-file-and-never-writes-one](../../../decisions/the-client-reads-a-token-file-and-never-writes-one.md).
4. Call it from both front ends and delete both copies of the old three-source order.
5. Turn a refusal into a `Fault` in the CLI so it prints as a sentence. The screen has no equivalent and keeps `loadConfig`'s existing behaviour.
6. Document the flag in both usages, and keep it out of `SWITCHES`.

## Validation

- `test/cli.test.ts`: the file is read as the host writes it; the two flags are refused together; a missing and an empty file are refused and nothing is created; the order is taken most-deliberate-first; both front ends parse and document it.
- By hand, against a running `ahpd --connection-token-file`: the host wrote the file at `0600`, `ahpc status` connected with it, and both a wrong token and no token were refused.
- `npm test` and `npm run typecheck` green.

## Resume

Done on 2026-09-24. Verified end to end against `ahpd` on `ws://127.0.0.1:9187`.
