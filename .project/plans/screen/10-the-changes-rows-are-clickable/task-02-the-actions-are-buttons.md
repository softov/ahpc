---
title: The actions are buttons
status: implemented
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

The actions row is a row of stock `Button`s with `size="sm"`, and a press runs `changes.run` with the operation id.
The tone is `danger` for an error and `warning` while the operation runs.
A button for an operation that the host disabled is disabled, because the picker on `x` leaves that operation out.
`test/changes.test.tsx` holds a click on Commit and a click on Create PR, at 100 and 60 columns.
It also holds Tab with Enter, `x` on a focused button and the list's first row, at both widths.
The status word in a label such as `(running)` comes from the protocol and is not in the i18n catalogue, as before this task.
