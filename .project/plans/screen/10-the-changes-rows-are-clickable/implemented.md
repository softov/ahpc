---
title: The scopes and actions on the changes screen are clicked or reached with Tab - implemented
date: 2026-10-11
refs:
  - "[code://src/screens.tsx](../../../../src/screens.tsx) - `ChangesScreen`, with the scopes as `Tabs` and the actions as `Button`s"
  - "[code://src/control.ts](../../../../src/control.ts) - `chooseScope`, used by `changes.scope` and by the tabs"
  - "[code://test/changes.test.tsx](../../../../test/changes.test.tsx) - the click, Tab and key cases at 100 and 60 columns"
---

On the changes screen, a click picks a scope and runs an action.
Tab reaches the scopes, where the arrows pick one, and then the actions, where Enter runs one.
The keys `]`, `r` and `x` work as before, also while a tab or a button has focus.

## What was built

- [`code://src/control.ts`](../../../../src/control.ts) - `chooseScope(store, uriTemplate)` sets `CHANGE_AT` and clears `OPEN_FILE`; `changes.scope` calls it.
- [`code://src/screens.tsx`](../../../../src/screens.tsx) - the scopes row is a stock `Tabs`, with a disabled tab for a scope that needs a turn. The actions row is stock `Button`s with `size="sm"`, one per entry of `chosenOperations`, and a press runs `changes.run` with the operation id.
- [`code://test/changes.test.tsx`](../../../../test/changes.test.tsx) - 18 new cases at 100 and 60 columns.

## Verified

- `npm run typecheck` clean.
- `npx vitest run` - 733 of 734 passed in the worktree. The failure is the smoke test that expects the folder name `ahpc`, and it fails at baseline in any worktree.
- With `onPress` removed, the 6 click and Enter cases fail, so they test the buttons.

## Departures from the plan

- Task 01 checks Tab with an arrow, not Tab with Enter. The stock `Tabs` picks with the arrows and binds no Enter, and Softov kept that.
- A button for an operation the host marked `disabled` is a disabled `Button`. The plan did not say. The `x` picker already leaves such operations out.
- A button's status word, such as "running", is the protocol's word and not in the catalogue, as it was in the row of labels before.

## Left for later

- An arrow stops at a disabled tab, so a scope past one is reached by a click or `]`. It is proposed in textui as `roadmap/ideas/tabs-skip-a-disabled-tab.md`.
- At 60 columns the status row may draw an empty hint where `] changeset` belongs. It is not checked against main yet.
