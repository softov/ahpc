---
title: A file is staged, unstaged, discarded or committed from its row, or with every file
domain: screen
status: active
priority: high
created: 2026-10-11
revalidated: 2026-10-11
requires: []
changes: []
creates: []
decisions: []
refs:
  - "[code://src/view/changes.tsx#L57-L70](../../../../src/view/changes.tsx#L57-L70) - the rows, with `+`, `-` or a chevron for the kind"
  - "[code://src/control.ts#L1879-L1990](../../../../src/control.ts#L1879-L1990) - `changes.run`: the target, the commit prompt and the confirmation"
  - "[code://src/control.ts#L3122-L3132](../../../../src/control.ts#L3122-L3132) - the changes screen's keys"
  - "[code://src/ahp/types.ts#L290-L312](../../../../src/ahp/types.ts#L290-L312) - `FileEdit`: `before` and `after` are URIs, and a rename has two different ones"
  - "[code://src/ahp/followup.ts#L126-L137](../../../../src/ahp/followup.ts#L126-L137) - `CREATE_PULL_REQUEST` and `chosenOperations`"
  - "[code://test/changes.test.tsx](../../../../test/changes.test.tsx) - the changes screen's tests, with the 60-column case"
  - npm://@textui/widgets - `Dialog` with `actions`, where the first action has the focus
  - "file:///github/ahpd/.project/plans/host/82-a-file-or-changeset-is-staged-or-committed/plan.md - the host side: the scopes and the rename"
---

## Goal

On the changes screen, a person stages, unstages, discards or commits the file on the selected row, or every file, with one key.
Each row shows its git status letter.
Today `x` opens a picker, and stage, unstage and discard act on the row only.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "keys: '(s|u|p|c|delete)'" src/control.ts` - all five are bound in other scopes only, so `CHANGES_SCOPE` can take them.
- `rg -n "onFile" src/control.ts` - `changes.run` sends a target only when the operation has no `changeset` scope.

### Runtime path

```
s / u / delete / c on a row -> changes.run(operation) -> scope dialog [This file, All files, Cancel] -> (commit: message prompt) -> invoke with or without a target
p -> changes.run('create-pr') -> the pull request form, as today
```

### Gaps

- `changes.run` cannot ask which target to use.
- A row cannot tell a rename from an edit until ahpd host/82 task 03 ships.

## Decisions locked in

| What | Source | Task |
| --- | --- | --- |
| A row shows its git status letter: M modified, A added, D deleted, R renamed, U untracked; the staged mark stays its own column | Softov, 2026-10-11, asked "Which letter should a row show?", answered "git status letters" | 01 |
| The letter comes from `before`, `after` and `staged`: no `before` and staged is A, no `before` and not staged is U, no `after` is D, two URIs is R, else M | (defaulted: the protocol carries all five once ahpd sends a rename) | 01 |
| A host that reports no staging shows A for a new file | (defaulted: U needs `staged` to tell it from A) | 01 |
| A renamed row reads `old -> new` | (defaulted: the letter alone does not say where the file came from) | 01 |
| Keys on the changes screen: `s` stage, `u` unstage, `delete` discard, `c` commit, `p` create pull request; `x` keeps the picker | Softov, 2026-10-11: "accept s to stage u unstage p to create del to discard changes"; asked about commit, answered "c commit, p pull request" | 02 |
| A key for an operation the host does not offer, or has disabled, does nothing | (defaulted: as the picker leaves it out) | 02 |
| Commit, discard, stage and unstage ask first, with the buttons This file, All files and Cancel, and This file has the focus | Softov, 2026-10-11: "show ui for confirmation, with buttons [all files, this file, cancel.] and this file as default selected for commit, discard changes, stage, unstage" | 03 |
| The buttons are in the order [This file, All files, Cancel], because the stock `Dialog` focuses its first; a textui proposal names a default action | Softov, 2026-10-11, asked "How should This file be the default?", answered "reorder and add proposal on textui" | 03 |
| All files shows only when the operation lists the `changeset` scope, and This file only when it lists `resource` and a row is selected | Softov, 2026-10-11, asked "how should All files work?", answered "host takes the whole set" | 03 |
| The dialog shows the host's confirmation; with none, it says the operation and the file, as "Stage src/a.ts?" | (defaulted: the protocol says a client MUST show the confirmation) | 03 |
| A commit asks for its message after the dialog, as today, and the prompt says what it takes: this file, or the staged files, or every file | (defaulted: one prompt for the message, as today) | 03 |
| Discard has a danger tone in the dialog | (defaulted: the host gives it a confirmation, which says it is destructive) | 03 |
| The click on a button, the picker on `x` and the keys all reach the same dialog | (defaulted: one path for a verb, whatever starts it) | 03 |

## Proposed architecture

- **Data flow** - the letter is derived in the view; no new store key.
- **Event flow** - each key runs `changes.run` with its operation id. `changes.run` opens the dialog, then sends the row as the target for This file and no target for All files.
- **Layer responsibilities** - `src/view/changes.tsx`: the letter · `src/control.ts`: the keys, the dialog and the target.
- **Source-of-truth files** - [`code://src/control.ts`](../../../../src/control.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - A row shows its git letter](task-01-a-row-shows-its-git-letter.md) | implemented | - |
| [02 - Keys run the operations](task-02-keys-run-the-operations.md) | implemented | - |
| [03 - A dialog asks this file or all files](task-03-a-dialog-asks-this-file-or-all-files.md) | implemented | 02 |

## Risks and tradeoffs

- Against an ahpd without host/82, stage, unstage and discard show This file only, commit shows All files only, and a rename reads as M.
- Commit is now two dialogs: the target, then the message.
- `ahpc changes --run` in the shell is not changed, so it cannot pick a target yet.
- The button order differs from Softov's until textui takes `roadmap/ideas/dialog-names-its-default-action.md`.

## Resume state

- **Done so far:** tasks 01, 02 and 03 are implemented and await review. See [implemented.md](implemented.md).
- **Next action:** the hand check against an ahpd with host/82, at 60 and 100 columns.
- **Open questions:** none.
- **Watch out for:** against an ahpd without host/82, stage, unstage and discard show This file only, and commit shows All files only.

## Final verification checklist

- [x] `npm run typecheck` clean.
- [x] `npx vitest run` passes, with the new cases in `test/changes.test.tsx`.
- [ ] By hand against an ahpd with host/82, at 60 and 100 columns: each key opens the dialog with This file focused, and both targets work.
- [x] `plans/index.md` updated.
