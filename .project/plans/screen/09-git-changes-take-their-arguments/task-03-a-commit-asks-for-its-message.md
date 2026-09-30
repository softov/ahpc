---
title: A commit asks for its message
status: todo
depends: [task-01-an-operation-carries-its-arguments.md, task-02-a-file-says-whether-it-is-staged.md]
layer: "screen"
refs:
  - "[code://src/control.ts#L1795-L1862](../../../../src/control.ts#L1795-L1862) - `changes.run`, where the verb is chosen and confirmed"
  - file:///github/ahpapp/src/components/CommitForm.tsx - the staged count and the host's confirmation inside the form
  - file:///github/ahpapp/src/components/ChangesView.tsx - `invoke` skipping the separate confirmation for a commit
  - file:///github/ahpd/packages/sdk/src/changes.ts - `ahp.commit.message`, and the session title when there is none
  - npm://@textui/widgets - `prompt`
---

## Objective

Choosing `commit` opens a prompt filled with the session title.
Its message says how many staged files it takes, or that it takes every change when nothing is staged, and carries the host's confirmation when the host sent one.
Submitting commits with that message under `_meta['ahp.commit'].message`; escape does nothing.

## Files

- `UPDATE: src/control.ts:1795-1862` - `commit` goes to the prompt instead of the confirm; the host's confirmation is in the prompt, not asked before it.
- `UPDATE: src/i18n/en/commands.ts`, `src/i18n/pt-BR/commands.ts`, `src/i18n/es/commands.ts` - the prompt's title, the count in one and many, and "every change".

## Steps

1. Branch on `operation.id === 'commit'` before the confirmation.
2. Count staged files from the held changeset.
3. An empty message is not sent as `ahp.commit`, so the host falls back to the session title.
4. The host's answer goes through task 05's handling.

## Validation

- `test/changes.test.tsx` - the prompt shows the count and the confirmation; submitting records `ahp.commit.message`; escape records nothing.
- `npx vitest run` passes.

## Resume

