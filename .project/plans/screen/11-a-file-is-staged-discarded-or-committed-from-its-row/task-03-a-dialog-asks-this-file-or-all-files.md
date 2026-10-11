---
title: A dialog asks this file or all files
status: todo
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
