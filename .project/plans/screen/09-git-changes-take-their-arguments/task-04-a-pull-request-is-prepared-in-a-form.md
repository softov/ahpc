---
title: A pull request is prepared, then read in a form
status: todo
depends: [task-01-an-operation-carries-its-arguments.md]
layer: "screen"
refs:
  - "[code://src/control.ts#L1795-L1862](../../../../src/control.ts#L1795-L1862) - `changes.run`, and the palette's list of verbs"
  - "[code://src/screens.tsx#L1206](../../../../src/screens.tsx#L1206) - `ChangesScreen`, whose verb row lists `prepare-pull-request` today"
  - "[code://src/screens.tsx#L1428](../../../../src/screens.tsx#L1428) - `NewAutomationScreen`, the `Form` and `TextArea` this copies"
  - file:///github/ahpapp/src/components/PullRequestForm.tsx - the fields, and the draft shown while the host prepares
  - file:///github/ahpapp/src/components/ChangesView.tsx - `openPullRequest`, prepare first and then the form
  - file:///github/ahpapp/src/changeset-followup.ts - `createPrMeta`
  - file:///github/ahpd/packages/sdk/src/changes.ts - `vscode.pullRequest`, `expectedContext`, and the refusal when the tree moved
---

## Objective

Choosing `create-pr` runs `prepare-pull-request`, then opens a modal form with the title, a description text area and a draft switch, filled from the draft, and the branches and repository shown read-only.
Submitting runs `create-pr` with `_meta['vscode.pullRequest']` carrying title, description, draft and the draft's `context` as `expectedContext`, unchanged.
`prepare-pull-request` is not listed when `create-pr` is; a host that offers only `create-pr` gets the form empty.

## Files

- `UPDATE: src/control.ts:1795-1862` - the `create-pr` branch, and the choices filter.
- `UPDATE: src/screens.tsx` - the form as a modal layer, and the verb row's filter.
- `UPDATE: src/i18n/en/commands.ts`, `src/i18n/pt-BR/commands.ts`, `src/i18n/es/commands.ts` - the form's labels and "preparing".

## Steps

1. Open the form at once saying it is preparing, and fill it when the draft arrives, as ahpapp does.
2. A refused prepare closes the form and leaves the host's words on the status row.
3. An empty title keeps the submit off.
4. The host's answer goes through task 05's handling.

## Validation

- `test/changes.test.tsx` - the form opens on the fake draft; submitting records `expectedContext` equal to the draft's `context`; `prepare-pull-request` is absent from the palette and the verb row when `create-pr` is offered; escape runs nothing.
- Checked at 60 and 100 columns.

## Resume

