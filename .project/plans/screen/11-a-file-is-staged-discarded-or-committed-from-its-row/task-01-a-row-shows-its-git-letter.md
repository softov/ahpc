---
title: A row shows its git letter
status: implemented
depends: []
layer: "screen"
refs:
  - "[code://src/view/changes.tsx#L57-L70](../../../../src/view/changes.tsx#L57-L70) - the rows"
  - "[code://src/ahp/types.ts#L290-L312](../../../../src/ahp/types.ts#L290-L312) - `FileEdit`"
---

## Objective

Each row on the changes screen shows its git status letter in place of `+`, `-` or the chevron.

## Files

- `UPDATE: src/view/changes.tsx:57-70` - the letter, its tone, and `old -> new` for a rename.
- `UPDATE: test/changes.test.tsx` - one row of each letter, at 60 and 100 columns.

## Steps

1. Write a function that gives the letter of a `FileEdit`.
2. No `before` and `staged` true gives A.
3. No `before` and `staged` not true gives U, when the host reports staging; otherwise A.
4. No `after` gives D.
5. A `before` and an `after` with different URIs give R.
6. Any other row gives M.
7. Show the letter as the row's icon.
8. Give A and U the success tone, D the danger tone, and R and M the warning tone.
9. For R, label the row `old -> new`, with both paths as the row shows a path today.

## Validation

- Each letter shows on a row of its kind.
- The staged mark column shows as before.
- At 60 columns a rename's label truncates and the list keeps its rows.

## Resume

`gitLetter(file, staging)` in `src/view/changes.tsx:32` gives M, A, D, R or U, and `LETTER_TONE` at line 40 gives the tone.
The row's icon is the letter, at `src/view/changes.tsx:91`.
A and U are `success`, D is `danger`, and R and M are `warning`.
A rename reads `old -> new`, with both paths as a row shows a path.
`staging` is the same flag that decides the staged mark column, so a host that reports no staging shows A for a new file.
`test/changes.test.tsx:408` holds 5 cases.
They check M, A and D on the session scope, and U, A and R on the working tree, at 100 and 60 columns.
One more case checks the rename label.
The two regexes in "what a commit will take" now match a letter after the staged mark.
