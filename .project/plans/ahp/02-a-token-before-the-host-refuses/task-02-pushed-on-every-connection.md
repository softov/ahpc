---
title: Every declared resource is authenticated on every connection, including a remade one
status: todo
depends: [task-01-the-chain-and-the-cache.md]
layer: "src/ahp/live.ts, src/connect.ts"
refs:
  - "[code://src/ahp/live.ts#L1748-L1800](../../../../src/ahp/live.ts#L1748-L1800) - the reconnect loop, which builds a fresh client and moves to `connected` without ever returning to `connect`"
  - "[code://src/ahp/live.ts#L1464](../../../../src/ahp/live.ts#L1464) - the first transport, the other place a connection becomes usable"
  - "[code://src/ahp/live.ts#L1688-L1700](../../../../src/ahp/live.ts#L1688-L1700) - `advertised`, already collecting `protectedResources` off every agent and deduplicating"
  - "[code://src/ahp/live.ts#L105-L120](../../../../src/ahp/live.ts#L105-L120) - `LiveHostOptions`, where a callback for this belongs"
  - "[code://src/connect.ts#L82-L120](../../../../src/connect.ts#L82-L120) - `connect`, which runs once and is therefore not on its own enough"
  - "[code://src/ahp/connection.ts#L259-L280](../../../../src/ahp/connection.ts#L259-L280) - `authenticate` and `protectedResources`, both optional on the seam"
  - file:///github/ahpd/packages/sdk/src/host.ts#L5656-L5680 - `connection.principal` and `connection.tokens`, kept per connection and so gone after a reconnect
---

## Objective

Any connection this client has, first or thirty-first, has already pushed a resource token for everything the host's agents declare and this process has one for.
Nothing is asked of the person and no failure reaches them.

## Steps

1. Do not put this in `connect`'s tail. The reconnect loop at `src/ahp/live.ts:1748` builds a fresh client and moves to `connected` without returning to `connect`, so a push placed there runs once and never again, while the host drops what it holds on every socket close.
2. Add a hook to `LiveHostOptions` that fires when a connection becomes usable, at the first transport and again at the end of each successful reconnect. Fire it after the channels resume, so a push never races the handshake.
3. In `connect`, answer that hook by asking what the host protects and pushing what `resolveToken` gives, from task 01. Decision [every-declared-resource-is-authenticated-on-connect](../../../decisions/every-declared-resource-is-authenticated-on-connect.md).
4. Do nothing at all when either `protectedResources` or `authenticate` is absent from the seam, and skip in silence any resource with no token.
5. Swallow every failure: a connection must not fail because a credential nobody asked for was refused. Apply task 01's rule so a `-32007` drops the cached entry and anything else leaves it alone.
6. Never prompt here and never report through `sink`. The silence is load-bearing, and on a flapping link a prompt per drop would be the whole of what the person sees.
7. Leave `src/mcp/` and `fakeHost` alone: this is for a live connection, and a fixture that authenticated itself would change what every existing screen test sees.

## Validation

- The wire tests in `test/reconnect.test.ts` are where this belongs, because that file already drives a drop and a resume: a host declaring a resource with a token available is authenticated once on the first connection and again after a forced reconnect.
- A host declaring nothing pushes nothing; a seam without `protectedResources` is untouched; an `authenticate` that throws still yields a usable connection.
- A cached token the host answers `-32007` to is gone afterwards; one it answers `-32602` to is still there.
- `test/auth.test.tsx` passes unchanged, which is what proves the fixture was not quietly authenticated out of its refusals.
- `npm test` and `npm run typecheck` green.

## Resume
