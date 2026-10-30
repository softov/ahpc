---
title: A dispatch resolves on its echo
status: todo
depends: []
layer: "ahp"
refs:
  - "[code://src/ahp/channels.ts#L216-L249](../../../../src/ahp/channels.ts#L216-L249) - `rejected` and `deliver`, where the echo is matched"
  - "[code://src/ahp/live.ts#L2012-L2023](../../../../src/ahp/live.ts#L2012-L2023) - `dispatch`, which becomes the waiting send"
  - "[code://src/ahp/live.ts#L3058-L3081](../../../../src/ahp/live.ts#L3058-L3081) - `stopTurn`, the never-rejecting shape"
---

## Objective

The seven dispatch methods of `HostConnection` resolve `{ refused?: string }` once the host echoes the action or refuses it.
`queue` resolves `{ id, refused? }`.

## Files

- `UPDATE: src/ahp/connection.ts:73-80` - `setArchived` and `setRead` return `Promise<Sent>`; add the `Sent` type with a doc comment.
- `UPDATE: src/ahp/connection.ts:158` - `writeTerminal` returns `Promise<Sent>`.
- `UPDATE: src/ahp/connection.ts:358-373` - `queue` returns `Promise<Sent & { id: string }>`; `unqueue`, `confirmToolCall` and `completeInput` return `Promise<Sent>`.
- `UPDATE: src/ahp/channels.ts:216-249` - add `await(clientSeq)` and settle it from an envelope whose origin names this client; a settled rejection is not given to `onRejection`.
- `UPDATE: src/ahp/live.ts:2012-2023` - `dispatch` holds the channel, sends, and resolves on the echo or after 10 seconds.
- `UPDATE: src/ahp/live.ts:2620-2626` - `writeTerminal` sends through the waiting send.
- `UPDATE: src/ahp/live.ts:2739-2749` - `setArchived` and `setRead` send through the waiting send.
- `UPDATE: src/ahp/live.ts:3024-3105` - `queue`, `unqueue`, `confirmToolCall` and `completeInput` return the waiting send; `queue` adds its id.
- `UPDATE: src/ahp/fake.ts:1719-1720` - `setArchived` and `setRead` resolve `{}`.
- `UPDATE: src/ahp/fake.ts:1813` - `writeTerminal` resolves `{}`.
- `UPDATE: src/ahp/fake.ts:2024-2067` - `queue` resolves its id; `unqueue`, `confirmToolCall` and `completeInput` resolve a refusal for an unknown id, else `{}`.
- `CREATE: test/dispatch.test.ts` - the cases in *Validation*.

## Steps

1. Add `Sent` to `connection.ts` as `{ refused?: string }`, and change the seven signatures.
2. In `openChannels`, add a map from `clientSeq` to a resolver, and a method that registers one.
3. In `deliver`, settle the resolver for an envelope whose `origin.clientId` is this client and whose `clientSeq` has one.
4. Do not give a settled rejection to `onRejection`.
5. On a reconnect, resolve every waiter with `refused` set to the connection's reason.
6. In `live.ts`, change `dispatch` to open the channel, send, register the `clientSeq`, and release the channel when settled.
7. Resolve `refused: "The host did not answer in 10 seconds."` when no echo arrives in time.
8. Route the seven methods through the waiting send, and return the id from `queue`.
9. Change the fake host to resolve at once, with a refusal for an unknown id.
10. Write `test/dispatch.test.ts`.

## Validation

- `test/dispatch.test.ts`: an echo with this client's origin resolves `{}`.
- `test/dispatch.test.ts`: an echo with `rejectionReason` resolves `{ refused }`, and `onRejection` is not called.
- `test/dispatch.test.ts`: an echo with another client's origin settles nothing.
- `test/dispatch.test.ts`: no echo resolves the timeout refusal.
- `npm run typecheck` passes.
- `npm test` passes.

## Resume
