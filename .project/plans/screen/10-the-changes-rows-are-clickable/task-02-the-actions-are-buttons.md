---
title: The actions are buttons
status: todo
depends: []
layer: "screen"
refs:
  - "[code://src/screens.tsx#L1377-L1390](../../../../src/screens.tsx#L1377-L1390) - the actions row"
  - "[code://src/control.ts#L1874](../../../../src/control.ts#L1874) - `changes.run`"
  - "[code://src/screens.tsx#L1480-L1495](../../../../src/screens.tsx#L1480-L1495) - the `Button`s in `PullRequestForm`"
---

## Objective

The actions row is a row of stock `Button`s, so a click or Tab with Enter runs an action.
`x` still opens the picker.

## Files

- `UPDATE: src/screens.tsx:1377-1390` - the actions row becomes `Button`s with `size="sm"`.
- `UPDATE: test/changes.test.tsx` - a click on an action and Tab with Enter each run it.

## Steps

1. Draw one `Button` per operation from `chosenOperations`, labelled as the row is today.
2. Set the tone from the status: `danger` for an error, `warning` while it runs.
3. On press, call `app.execute('changes.run', { operation: operation.id })`.
4. Let the row wrap or truncate at 60 columns, so the list keeps its rows.

## Validation

- A click on Commit opens the message prompt, as `x` and Commit do.
- A click on Create pull request opens the form.
- Tab reaches the buttons after the tabs, and Enter on one runs it.
- At 60 columns the list still shows its first row.

## Resume
