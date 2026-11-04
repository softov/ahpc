---
title: The provider comes from the host
status: done
depends: []
layer: "screen"
refs:
  - "[code://src/control.ts#L352](../../../../src/control.ts#L352) - the default this removes"
  - "[code://src/screens.tsx#L580-L593](../../../../src/screens.tsx#L580-L593) - the settings read"
---

## Objective

The provider is empty until the host lists its agents, and is then the first of them.
No settings read goes out with an empty provider.

## Files

- `UPDATE: src/control.ts:352` - start `PROVIDER` empty.
- `UPDATE: src/control.ts:1253-1262` - `settings` answers an empty config while the provider is empty.
- `UPDATE: src/control.ts:1417` - the gates read an empty provider as no agent.
- `UPDATE: src/control.ts:1443-1456` - after the agents arrive, set `PROVIDER` to the first one while it is empty.
- `UPDATE: src/screens.tsx:580-593` - skip the settings read while the provider is empty.
- `UPDATE: test/` - the cases in *Validation*, in the file that tests the new session screen.

## Steps

1. Set `PROVIDER` to `''` at boot in `control.ts`.
2. Remove the `'claude'` fallbacks at lines 1258 and 1417.
3. List the agents once at boot, if nothing lists them yet.
4. Set `PROVIDER` to the first agent's provider when the list arrives and `PROVIDER` is empty.
5. Return an empty config from `settings` while `PROVIDER` is empty, and send nothing.
6. Skip the effect's settings read while the provider is empty.

## Validation

- A test: a scripted host with the agents `notes` and `echo` starts on `notes`.
- A test: that host shows no error on the status row.
- A test: a scripted host with no agents sends no `resolveConfig`.
- A test: the scripted host as it is starts on `claude`, as today.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.

## Resume
