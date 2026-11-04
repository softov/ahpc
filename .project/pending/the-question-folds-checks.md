---
title: Check that the waiting question folds to one line while you read
plans:
  - plans/screen/20261104-0549-the-question-folds-while-you-read/plan.md
---

# Check that the waiting question folds to one line while you read

PR #11 is merged on `main`.
These checks close the plan.

## Set up

1. Do steps 1 to 11 of *Set up* in [hand-check-findings.md](hand-check-findings.md).
2. Run `<ahpc>` with no command, and open `<session>` from the list.
3. Set the permissions chip under the composer to *Ask each time*.
4. Send "Run `ls` in the workspace."

## Fold and answer

1. When the question shows, press escape.
2. Check that one yellow line shows: `⚠ Run ...? · a approve · d deny · click to open`.
3. Check that the hint row shows `a approve · d deny · esc back`.
4. Press `a`, and check that the command runs.
5. Send the message again, press escape, and press `d`. Check that the command is denied.

## Open it again

1. Send the message again, and press escape.
2. Click the yellow line. Check that the full question shows, with focus on *Approve*.
3. Press escape, then `i`. Check that the full question shows again.

## A narrow terminal

1. Make the terminal 60 columns wide, and fold the question.
2. Check that the title is cut short and the keys stay on the line.

## Reply

- Write "validated", or what you saw that differs.
