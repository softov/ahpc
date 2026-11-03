---
title: Check screen/11 against an ahpd with host/82
plans:
  - plans/screen/11-a-file-is-staged-discarded-or-committed-from-its-row/plan.md
---

# Check screen/11 against an ahpd with host/82

screen/11 is built, and its cases pass in `test/changes.test.tsx` against the fake host.
This run checks the keys and the dialog against a real ahpd, at 60 and 100 columns.
ahpd `main` has host/82, so it offers stage, unstage, discard and commit for one file and for the changeset.

## Set up

1. Do steps 1 to 10 of *Set up* in [screen-10-clickable-rows-checks.md](screen-10-clickable-rows-checks.md).
2. Open the session, and press `c` to open the changes.
3. Pick the scope of uncommitted changes.

## screen/11: the rows at 100 columns

1. Set the terminal to 100 columns.
2. Check that the edited file shows `M`, the deleted file shows `D` and the new file shows `U` or `A`.
3. Check that the hint row names only the keys of the verbs that the changeset offers.

## screen/11: each key opens the dialog at 100 columns

1. Select the edited file, and press `s`.
2. Check that a dialog opens with This file, All files and Cancel, and that This file has the focus.
3. Press Enter, and check that only the selected file is staged.
4. Press `u`, choose This file, and check that the file is unstaged.
5. Press `s`, choose All files, and check that every file is staged.
6. Press `u`, choose All files, and check that every file is unstaged.
7. Select the new file, press `delete`, choose This file, and check that only that file is gone.
8. Press Cancel in any dialog, and check that nothing changes.

## screen/11: commit at 100 columns

1. Stage one file with `s` and This file.
2. Press `c`, choose This file, write a message, and check that the commit holds only that file.
3. Press `c`, choose All files, write a message, and check that the commit holds what was staged, or every change when nothing was.
4. Press `p`, and check that the pull request form opens.
5. Close the form, and check `git log` and `git status` in `<work>`.

## screen/11: all checks at 60 columns

1. Restore `<work>` to the state of steps 6 and 7 of the screen/10 *Set up*.
2. Set the terminal to 60 columns.
3. Do the three sections of 100 columns again.
4. Check that the dialog's three buttons fit on one row.

## Known limits

- At 60 columns the hint row cuts its labels, as it did before this plan.
- The buttons stay in the order This file, All files, Cancel.

## Reply

- Write "ok", or what went wrong at which step.
