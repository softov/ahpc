---
title: A dialog asks this file or all files
status: implemented
depends: [02]
layer: "screen"
refs:
  - "[code://src/control.ts#L1898-L1990](../../../../src/control.ts#L1898-L1990) - `changes.run`"
  - npm://@textui/widgets - `Dialog` with `actions`, where the first action has the focus
---

## Objective

Commit, discard, stage and unstage open a dialog with the buttons This file, All files and Cancel.
This file has the focus.
The choice decides whether the call carries the row as its target.

## Files

- `UPDATE: src/control.ts:1898-1990` - the dialog, and the target from the choice.
- `UPDATE: src/i18n` catalogues - the three button labels, the fallback question, and the commit prompt's three lines.
- `UPDATE: test/changes.test.tsx` - each operation with each choice, against a host that lists both scopes and one that lists one.

## Steps

1. For `commit`, `discard`, `stage` and `unstage`, open a `Dialog` layer before anything else.
2. Add This file when the operation lists `resource` and the list has a selected row.
3. Add All files when the operation lists `changeset`.
4. Add Cancel last, and put the buttons in the order This file, All files, Cancel.
5. Show the host's confirmation as the message; with none, show the label and the row's path, as "Stage src/a.ts?".
6. Give the dialog the danger tone when the host sent a confirmation for a write.
7. On Cancel or Escape, stop.
8. For commit, open the message prompt as today.
9. In the prompt, say what the commit takes: this file, the staged files, or every file.
10. Send `{ kind: 'resource', resource: row }` for This file, and no target for All files.

## Validation

- `s` on a row opens the dialog with This file focused, and Enter stages that file only.
- All files stages every file in one call with no target.
- Against a host that lists only `resource`, the dialog shows This file and Cancel.
- Commit on This file commits that file only, and another staged file stays staged.
- Discard on All files shows the host's confirmation with the danger tone.
- The buttons on the actions row and the picker on `x` open the same dialog.
- At 60 columns the three buttons fit or wrap, and Tab reaches all three.

## Resume

`askTarget` at `src/control.ts:1351` opens the stock `Dialog` as a modal layer, the way `confirm` does, with the id `TARGET_LAYER` from `src/state.ts`.
The buttons are This file, All files and Cancel, in that order, and each verb button shows only when the host lists its scope.
`ASKS_TARGET` in `src/ahp/followup.ts:132` names the four verbs that ask: commit, discard, stage and unstage.
`changes.run` asks first for those four, at `src/control.ts:1948`, and sends the row as the target for This file and no target for All files.
The message is the host's confirmation, or "Stage src/a.ts?", or "Stage all files?" when only All files shows.
A host confirmation gives the This file and All files buttons the `danger` tone.
The `confirm` step that follows is skipped for these four, because the dialog already showed the confirmation.
The commit prompt at `src/control.ts:1980` says "Commits this file only.", the staged count, or every change.
`test/changes.test.tsx:544` holds 18 cases, 9 at each of 100 and 60 columns, against fake changesets that list both scopes, only `resource` or only `changeset`.
Five existing commit tests now press Enter in the dialog first. The test of the host confirmation in the commit prompt now checks it in the dialog.

Departures:

- The dialog has no tone of its own, so the danger tone is on the two verb buttons. `confirm` does the same with its confirm button.
- The dialog is 56 cells wide, so the Portuguese and Spanish buttons fit on one row at 60 columns.
- The fake host is not changed. The tests wrap it with `offering()`, which replaces the working tree's operations and records the calls.
- "Commit on This file leaves another staged file staged" is the host's behaviour. The tests check that the call carries the row as its target.
