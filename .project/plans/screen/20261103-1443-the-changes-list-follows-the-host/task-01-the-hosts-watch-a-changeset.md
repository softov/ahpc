---
title: The hosts watch a changeset
status: done
depends: []
layer: "host"
refs:
  - "[code://src/ahp/live.ts#L2669-L2704](../../../../src/ahp/live.ts#L2669-L2704) - `watchTerminal`, the pattern to copy"
  - "[code://src/ahp/live.ts#L1346](../../../../src/ahp/live.ts#L1346) - `changeset`, the decoder"
  - "[code://src/ahp/fake.ts#L2188-L2292](../../../../src/ahp/fake.ts#L2188-L2292) - the fake's `review` and `invoke`"
  - "[code://src/ahp/connection.ts#L176](../../../../src/ahp/connection.ts#L176) - `watchTerminal` on the seam"
---

## Objective

The live host and the fake host each give `watchChanges(changeset, observer)`.
The observer gets the changeset when the channel opens, and again after each action.

## Files

- `UPDATE: src/ahp/connection.ts:176` - add `watchChanges` next to `watchTerminal`.
- `UPDATE: src/ahp/live.ts:2669-2704` - add `watchChanges` after `watchTerminal`, with `changesetReducer`.
- `UPDATE: src/ahp/fake.ts:2188-2292` - keep the watchers per changeset, and tell them in `review` and `invoke`.
- `UPDATE: test/reconnect.test.ts` - a live case: the snapshot, then a `fileRemoved` action, reach the observer.

## Steps

1. Add `watchChanges(changeset: string, observer: (changes: Changeset) => void): { close(): void }` to `HostConnection`.
2. In `live.ts`, open the channel with `channels.open`, as `watchTerminal` does.
3. On `opened`, keep the state, and give the observer `changeset(state)`.
4. On an action, apply `changesetReducer` to the state, and give the observer `changeset(state)`.
5. On `refused`, call `onRefusal` with the kind `read`.
6. On `close`, stop the observer and release the hold.
7. In `fake.ts`, keep a set of observers for each changeset URI.
8. On `watchChanges`, give the observer the changeset now, and add it to the set.
9. In `review` and `invoke`, give the new changeset to the set of that changeset.
10. Remove the session `changes` event from `review` and `invoke`.
11. Fix each other `HostConnection` that typecheck reports.

## Validation

- A live observer gets the snapshot, and then the list without the file after `changeset/fileRemoved`.
- A fake observer gets the changeset after `invoke` and after `review`.
- `npm run typecheck` passes.
