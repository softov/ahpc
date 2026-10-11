---
title: The scopes are tabs
status: implemented
depends: []
layer: "screen"
refs:
  - "[code://src/screens.tsx#L1355-L1375](../../../../src/screens.tsx#L1355-L1375) - the scopes row"
  - "[code://src/control.ts#L1823-L1837](../../../../src/control.ts#L1823-L1837) - `changes.scope`"
---

## Objective

The scopes row is a stock `Tabs`, so a click or Tab with Enter picks a scope.
`]` still moves to the next one.

## Files

- `UPDATE: src/screens.tsx:1355-1375` - the scopes row becomes `Tabs`, with a disabled item for a scope that needs a turn.
- `UPDATE: src/control.ts:1823-1837` - one function that sets `CHANGE_AT` and clears `OPEN_FILE`, used by `changes.scope` and by the tabs.
- `UPDATE: test/changes.test.tsx` - a click on a tab and Tab with Enter each move the scope.

## Steps

1. Draw `Tabs` with one item per scope, `activeId` the chosen scope, and `disabled` where the scope has variables.
2. Keep the label of a disabled tab as `screens.changes.needsTurn` gives it today.
3. Move the body of `changes.scope` into a function that takes a scope, and call it from `onChange`.
4. Keep `autoFocus` on the list, not on the tabs.

## Validation

- A click on the second tab shows that scope's files and closes an open file.
- Tab reaches the tabs, and `left` and `right` pick a scope.
- A disabled tab does not move the scope.
- `]` still moves to the next reachable scope.

## Resume

The scopes row is a stock `Tabs`, and `chooseScope` in `src/control.ts` sets `CHANGE_AT` and clears `OPEN_FILE` for `changes.scope` and for the tabs.
A click picks a scope, and `right` picks the next one.
A disabled tab does not move the scope, and `]` and `r` work while the tabs have focus.
`test/changes.test.tsx` holds these cases at 100 and 60 columns.
An arrow stops at a disabled tab and does not skip it, which is the stock `Tabs` and is proposed in textui as `roadmap/ideas/tabs-skip-a-disabled-tab.md`.
