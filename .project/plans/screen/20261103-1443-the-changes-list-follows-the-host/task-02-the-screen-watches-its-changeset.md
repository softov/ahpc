---
title: The changes screen watches its changeset
status: implemented
depends: [task-01-the-hosts-watch-a-changeset.md]
layer: "screen"
refs:
  - "[code://src/screens.tsx#L1270-L1280](../../../../src/screens.tsx#L1270-L1280) - the read of the chosen changeset"
  - "[code://src/control.ts#L246](../../../../src/control.ts#L246) - `Controller.changesAt`"
  - "[code://src/control.ts#L1245](../../../../src/control.ts#L1245) - where the controller passes `changesAt` to the host"
---

## Objective

While the changes screen is open, the list shows each change that the host sends for the chosen changeset.
A commit, a stage, a discard and a review tick redraw the list without `]`.

## Files

- `UPDATE: src/control.ts:246` - add `watchChanges` to `Controller`.
- `UPDATE: src/control.ts:1245` - pass `watchChanges` to the host.
- `UPDATE: src/screens.tsx:1270-1280` - watch the chosen changeset, in place of the one read.
- `UPDATE: test/changes.test.tsx` - the cases in *Validation*.

## Steps

1. Add `watchChanges(changeset, observer)` to `Controller`, and pass it to the host.
2. In the changes screen, watch the chosen changeset.
3. Write each changeset that the watch gives to `CHANGES`.
4. Close the watch when the scope or the session changes, and when the screen closes.

## Validation

- After a commit on the fake host, the list shows the changeset that `invoke` made, without `]`.
- After `r`, the tick shows, without `]`.
- After the scope changes, a change to the old changeset does not reach the list.
- With the watch removed, the commit case fails.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
