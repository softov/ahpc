---
title: The changes list follows the host while the screen is open - implemented
date: 2026-11-03
refs:
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts) - `watchChanges` and the loaded `changesetReducer`"
  - "[code://src/ahp/fake.ts](../../../../src/ahp/fake.ts) - `watchChanges`, `changeWatchers` and `tellWatchers`"
  - "[code://src/ahp/connection.ts](../../../../src/ahp/connection.ts) - `HostConnection.watchChanges`"
  - "[code://src/control.ts](../../../../src/control.ts) - `Controller.watchChanges`"
  - "[code://src/screens.tsx](../../../../src/screens.tsx) - the changes screen watches the chosen changeset"
---

While the changes screen is open, it holds the channel of the chosen changeset.
Each action that the host sends goes through `changesetReducer`, and the list redraws.
A commit, a stage, a discard and a review tick show without `]`.

## What was built

- [`code://src/ahp/connection.ts`](../../../../src/ahp/connection.ts) - `watchChanges(changeset, observer)`, the same shape as `watchTerminal`.
- [`code://src/ahp/live.ts`](../../../../src/ahp/live.ts) - `watchChanges` holds the channel with `channels.open`, and applies `changesetReducer` to each action. A refusal goes to `onRefusal` as a read.
- [`code://src/ahp/fake.ts`](../../../../src/ahp/fake.ts) - `watchChanges` keeps the observers of each changeset. `review` and `invoke` tell them, and no longer send the session `changes` event.
- [`code://src/control.ts`](../../../../src/control.ts) - `Controller.watchChanges` passes the watch to the host.
- [`code://src/screens.tsx`](../../../../src/screens.tsx) - the effect watches the chosen changeset, and closes the watch when the session or the scope changes.

## Verified

- `npm run typecheck` clean.
- `npm run build` clean.
- `npx vitest run` - 836 of 836 passed.
- New cases: a live watcher gets the snapshot, `fileRemoved` and `filesReviewChanged`, and nothing after the close. A commit empties the list. A tick on a scope no longer on screen leaves the list alone.
- Mutations: the one-shot read failed 31 cases, the commit and tick cases among them. A watch that never closes failed the scope case. The live watch without the reducer failed the live case.

## Departures from the plan

- The fake gives the first state after the subscribe, in a microtask, as a host's snapshot arrives after the subscribe.
- Three test hosts in `test/changes.test.tsx` rewrote `changes`. They now rewrite `watchChanges` through one helper, `reshape`.
- The fake's tick test in `test/fake.test.ts` watches the changeset in place of the session.
- The `readChanges` action name and its three labels are removed, because nothing reads a changeset that way now.
