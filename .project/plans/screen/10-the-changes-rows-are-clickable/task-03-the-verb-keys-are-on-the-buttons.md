---
title: The verb keys are on the buttons
status: todo
depends: [task-02-the-actions-are-buttons.md]
layer: "screen"
refs:
  - "[code://src/screens.tsx#L1366-L1381](../../../../src/screens.tsx#L1366-L1381) - the actions row"
  - "[code://src/app.tsx#L237-L247](../../../../src/app.tsx#L237-L247) - `verbs`, the verb hints of the status row"
  - "[code://src/app.tsx#L389-L391](../../../../src/app.tsx#L389-L391) - the changes hints, which add `verbs`"
  - "[code://src/control.ts#L3290-L3296](../../../../src/control.ts#L3290-L3296) - the five verb bindings"
  - npm://@textui/widgets - `Button.hint`, a key drawn after the label
---

## Objective

Each action button shows its key after its label, such as `Commit c`.
The status row of the changes screen no longer lists the verb keys, so its other hints fit.

## Files

- `UPDATE: src/control.ts:3290-3296` - one exported table of verb keys, and the five bindings read from it.
- `UPDATE: src/screens.tsx:1366-1381` - each `Button` gets `hint` from the table.
- `UPDATE: src/app.tsx:237-247` - remove `offered` and `verbs`.
- `UPDATE: src/app.tsx:389-391` - the changes hints stop at `x`.
- `UPDATE: src/i18n/en/views.ts` - remove the five verb hint keys.
- `UPDATE: src/i18n/pt-BR/views.ts` - remove the same keys.
- `UPDATE: src/i18n/es/views.ts` - remove the same keys.
- `UPDATE: test/changes.test.tsx` - the cases in *Validation*.

## Steps

1. Export `VERB_KEYS` from `src/control.ts`, which maps `stage`, `unstage`, `discard`, `commit` and create-pr to their chords.
2. Register the five verb bindings from `VERB_KEYS`.
3. Give each action `Button` the `hint` of its operation id, and write `delete` as `del`.
4. Give no `hint` to an operation that `VERB_KEYS` does not name.
5. Remove `offered`, `verbs` and the `...verbs` spread from `src/app.tsx`.
6. Remove `views.app.hintStage`, `hintUnstage`, `hintDiscard`, `hintCommit` and `hintPullRequest` from the three catalogues.

## Validation

- A test: the Commit button shows `c`, and the Discard button shows `del`.
- A test: an operation with no key shows its label only.
- A test: the status row of the changes screen shows no verb key.
- A test: `s`, `u`, `delete` and `c` still run their verbs.
- Run `npm run typecheck` and `npx vitest run`, one after the other, and check that both pass.

## Resume
