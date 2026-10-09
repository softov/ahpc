---
title: A VS Code 1.141 host is reached at 0.10.0 - implemented
---

## What exists now

- `src/ahp/live.ts` `VERSIONS` is `1.0.0, 0.10.0, 0.9.0, 0.8.0, 0.7.0`, and its comment says which host answers `0.10.0`.
- ahpc reads only the `snapshots` of the `initialize` result, never its `protocolVersion`, so a `0.10.0` answer needs no other change.
- `test/scenario.ts` `Scripted` has a `protocolVersion` field, the version its `initialize` answers with.

## Verified

- `test/reconnect.test.ts` has three new tests: the offered order, a `0.10.0` host that loads the session list, and canvas actions that keep the session usable.
- `npm run typecheck` and `npm run build` pass, and `npx vitest run` passes on main.
- Not verified: a live connection to a VS Code 1.141 host.

## Departures from the plan

- Step 1 found no code that reads the negotiated version, so nothing reads `0.10.0` as `1.0.0` in code.
