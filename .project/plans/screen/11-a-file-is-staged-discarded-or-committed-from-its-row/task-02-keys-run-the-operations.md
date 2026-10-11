---
title: Keys run the operations
status: implemented
depends: []
layer: "screen"
refs:
  - "[code://src/control.ts#L3122-L3132](../../../../src/control.ts#L3122-L3132) - the changes screen's keys"
  - "[code://src/ahp/followup.ts#L126-L129](../../../../src/ahp/followup.ts#L126-L129) - `CREATE_PULL_REQUEST`"
---

## Objective

On the changes screen, `s`, `u`, `delete`, `c` and `p` each run one operation.
`x` still opens the picker.

## Files

- `UPDATE: src/control.ts:3122-3132` - five bindings in `CHANGES_SCOPE`.
- `UPDATE: src/control.ts:1879-1900` - `changes.run` does nothing for an operation that the host disabled.
- `UPDATE: src/i18n` catalogues - the hint for each key, in English, Portuguese and Spanish.
- `UPDATE: test/changes.test.tsx` - each key, and a key for an operation the host does not offer.

## Steps

1. Bind `s` to `changes.run` with `{ operation: 'stage' }`.
2. Bind `u` to `unstage`, `delete` to `discard`, `c` to `commit` and `p` to `CREATE_PULL_REQUEST`.
3. Put all five in `CHANGES_SCOPE`, so they do not fire on other screens or in a text field.
4. In `changes.run`, return when the operation is missing or has the status `disabled`.

## Validation

- Each key runs its operation, through the same path as `x`.
- A key for an operation the host does not offer does nothing.
- `c` on the chat screen still opens the changes screen.

## Resume

`s`, `u`, `delete`, `c` and `p` are bound in `CHANGES_SCOPE` at `src/control.ts:3201-3205`, each to `changes.run` with its operation id.
`changes.run` returns when the operation is missing or `disabled`, at `src/control.ts:1944`.
The hint row on the changes screen names a verb key only when the changeset offers that verb and has not disabled it, at `src/app.tsx:241`.
The hints are in the catalogues as `views.app.hintStage`, `hintUnstage`, `hintDiscard`, `hintCommit` and `hintPullRequest`, in English, Portuguese and Spanish.
`test/changes.test.tsx:486` holds 7 cases.
Four check the dialog keys, and one checks that `p` opens the pull request form.
One checks that a disabled verb and an absent verb do nothing.
One checks that `c` on the chat screen still opens the changes screen.
At 60 columns the hint row truncates its labels. It already did before this task.
