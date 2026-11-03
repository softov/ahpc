---
title: A new session is `ahp-session:`
status: done
depends: []
layer: "ahp"
refs:
  - "[code://src/ahp/live.ts#L2383-L2418](../../../../src/ahp/live.ts#L2383-L2418) - `createSession`"
  - "[code://test/scenario.test.ts#L39-L40](../../../../test/scenario.test.ts#L39-L40) - the expectation to change"
---

## Objective

`createSession` sends and returns `ahp-session:/<uuid>`, with the provider in `provider`.

## Files

- `UPDATE: src/ahp/live.ts:2383-2396` - name the session `ahp-session:/<uuid>`, and replace the comment with the protocol's rule.
- `UPDATE: src/links.ts:61-67` - the comment says another client may name a session `<provider>:/`.
- `UPDATE: test/scenario.test.ts:39-40` - expect `ahp-session:/`.
- `UPDATE: test/scenario.test.ts` - a case that `createSession` sends `provider` beside the `ahp-session:/` channel.

## Steps

1. Change the URI in `createSession` to `ahp-session:/${randomUUID()}`.
2. Replace the comment with one sentence: the protocol does not encode the provider in the scheme.
3. Change the comment on `sessionOfLink`.
4. Change the test expectation, and add the case on the request's `provider`.

## Validation

- `test/scenario.test.ts`: a created session starts with `ahp-session:/`, and the request carries `provider: 'claude'`.
- `npm run typecheck` passes.
- `npm test` passes.
- By hand against ahpd: the checks in the plan's *Final verification checklist*.

## Resume

`createSession` names the session `ahp-session:/${randomUUID()}` at `src/ahp/live.ts:2449`, with `provider` still in the request beside the channel; the comment above it says the scheme names the kind of resource, not the provider.
The comment on `sessionOfLink` at `src/links.ts:64-66` now says this client starts `ahp-session:/` and an older client or host may have started `<provider>:/`.
`test/scenario.test.ts:41` expects the new scheme, and `:77` is the case for the request's `provider` and `channel`.

Departures: none.
