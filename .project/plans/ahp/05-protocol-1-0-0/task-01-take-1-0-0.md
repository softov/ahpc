---
title: Take 1.0.0 and offer it first
status: todo
depends: []
layer: "ahp"
refs:
  - "[code://package.json#L56](../../../../package.json#L56) - the dependency"
  - "[code://src/ahp/live.ts#L207](../../../../src/ahp/live.ts#L207) - `VERSIONS`"
---

## Objective

`package.json` and the lockfiles take 1.0.0, `VERSIONS` offers it first, and the strict schema is regenerated from it.

## Files

- `UPDATE: package.json`, `package-lock.json`, `deno.lock` if it pins the package.
- `UPDATE: src/ahp/live.ts:207`.
- `UPDATE: tools/ahp.strict.schema.json` - `npm run schema`.
- `UPDATE: UPSTREAM.md` - the version ahpc is on.
- `UPDATE: test/` - any test that asserts the offered versions.

## Steps

1. `npm i @microsoft/agent-host-protocol@^1.0.0`.
2. `VERSIONS = ['1.0.0', '0.9.0', '0.8.0', '0.7.0']`.
3. `npm run schema`.
4. `npx tsc --noEmit`, `npx vitest run`.

## Validation

- Both pass; an ahpc `--wire` capture against ahpd shows `protocolVersion: "1.0.0"` in the `initialize` result.

## Resume

