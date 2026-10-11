---
title: A file is staged, unstaged, discarded or committed from its row, or with every file - implemented
date: 2026-10-11
refs:
  - "[code://src/view/changes.tsx](../../../../src/view/changes.tsx) - `gitLetter` and the row's letter"
  - "[code://src/control.ts](../../../../src/control.ts) - `askTarget`, `changes.run` and the five keys"
  - "[code://src/ahp/followup.ts](../../../../src/ahp/followup.ts) - `ASKS_TARGET`"
  - "[code://src/app.tsx](../../../../src/app.tsx) - the verb hints on the changes screen"
  - "[code://test/changes.test.tsx](../../../../test/changes.test.tsx) - the letter, key and dialog cases at 100 and 60 columns"
---

Each row on the changes screen shows its git letter: M, A, D, R or U.
On the changes screen, `s` stages, `u` unstages, `delete` discards, `c` commits and `p` opens the pull request form.
Stage, unstage, discard and commit open a dialog with This file, All files and Cancel, and This file has the focus.
The keys, the buttons on the actions row and the picker on `x` all reach the same dialog.

## What was built

- [`code://src/view/changes.tsx`](../../../../src/view/changes.tsx) - `gitLetter(file, staging)` and its tones. A rename reads `old -> new`.
- [`code://src/control.ts`](../../../../src/control.ts) - `askTarget` opens the stock `Dialog` as a modal layer. `changes.run` asks it for the four verbs in `ASKS_TARGET`, ignores a disabled verb, and sends the row as the target only for This file. The commit prompt says what the commit takes. Five keys in `CHANGES_SCOPE`.
- [`code://src/app.tsx`](../../../../src/app.tsx) - a verb key is hinted only when the changeset offers that verb.
- The catalogues - the button labels, the fallback questions, the commit line and the five hints, in English, Portuguese and Spanish.
- [`code://test/changes.test.tsx`](../../../../test/changes.test.tsx) - 30 new cases. Six existing commit cases were changed for the dialog.

## Verified

- `npm run typecheck` clean.
- `npm run build` clean.
- `npx vitest run` - 763 of 764 passed in the worktree. The failure is the smoke test that expects the folder name `ahpc`, and it fails at baseline in any worktree.
- The dialog was drawn at 60 columns in English, Portuguese and Spanish, and the three buttons fit on one row.

## Departures from the plan

- The stock `Dialog` has no tone, so the danger tone is on the This file and All files buttons.
- The dialog is 56 cells wide, so the Portuguese and Spanish buttons fit at 60 columns.
- With only All files offered, the fallback question is "Stage all files?", because there is no row to name.
- The commit prompt no longer repeats the host's confirmation, because the dialog shows it.
- The fake host is not changed. The tests wrap it to offer stage, unstage, discard and commit with one scope or both.

## Left for later

- The hand check against an ahpd with host/82, at 60 and 100 columns.
- At 60 columns the hint row truncates its labels, and the verb hints make it longer. It truncated before this plan.
- The button order stays This file, All files, Cancel until textui takes `roadmap/ideas/dialog-names-its-default-action.md`.
- `ahpc changes --run` in the shell still cannot pick a target.
