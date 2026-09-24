---
title: Every declared resource is authenticated when the connection comes up
status: todo
depends: [task-01-the-chain-and-the-file.md]
layer: "src/connect.ts"
refs:
  - "[code://src/connect.ts#L82-L120](../../../../src/connect.ts#L82-L120) - `connect`, the one place a connection is made, and where this runs before the host is asked anything"
  - "[code://src/ahp/live.ts#L1688-L1700](../../../../src/ahp/live.ts#L1688-L1700) - `advertised`, which already collects `protectedResources` off every agent and deduplicates by resource"
  - "[code://src/ahp/connection.ts#L259-L280](../../../../src/ahp/connection.ts#L259-L280) - `authenticate` and `protectedResources`, both optional on the seam and so both to be checked before use"
  - "[code://src/ahp/fake.ts](../../../../src/ahp/fake.ts) - `protect` and `asked`, the fixture hooks a test drives this through"
  - file:///home/softov/projects/ahpx/src/session/connect-helper.ts#L118-L128 - the same step in ahpx, run after connect and before the callback
---

## Objective

A connection that is up has already pushed a token for every resource the host's agents declare and this machine has one for.
Nobody is asked anything, nothing is drawn, and a host that wants no token sees no extra traffic beyond the one question about what it protects.

## Steps

1. After `liveHost` resolves in `connect`, and before the connection is handed back, ask the host what it protects and push what resolves. Decision [every-declared-resource-is-authenticated-on-connect](../../../decisions/every-declared-resource-is-authenticated-on-connect.md).
2. Do nothing at all when either `protectedResources` or `authenticate` is absent from the seam. Both are optional and a host may serve neither.
3. Resolve each resource through `resolveToken` from task 01. A resource with no token is skipped in silence: it is the prompt's job, not this step's.
4. Every failure is swallowed, including a rejected token and a `protectedResources` that throws. A connection must not fail because a credential nobody asked for was refused, and the refusal path is still there to catch it properly later.
5. Do not prompt here under any circumstance, and do not report through `sink`. Decision [every-declared-resource-is-authenticated-on-connect](../../../decisions/every-declared-resource-is-authenticated-on-connect.md) names the silence as load-bearing.
6. Leave `src/mcp/` and the `fakeHost` path alone: this runs for a live connection, and a fixture that authenticates itself would change what every existing screen test sees.

## Validation

- `test/connect.test.ts` or the nearest existing home: a host declaring two resources with a token available for one pushes exactly one `authenticate`, for that one; a host declaring none pushes nothing; a host whose `authenticate` throws still yields a usable connection; a seam without `protectedResources` is untouched.
- `test/auth.test.tsx` still passes unchanged, which is what proves this did not quietly authenticate the fixture out of its refusals.
- `npm test` and `npm run typecheck` green.

## Resume
