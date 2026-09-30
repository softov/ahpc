---
title: Command ids read verb.noun
status: todo
depends: []
layer: "ahpc screen"
refs:
  - "[code://src/control.ts#L1175](../../../../src/control.ts#L1175) - every command id and the default bindings"
  - "[code://src/tui.tsx#L409](../../../../src/tui.tsx#L409) - where the config's `keys` are bound to ids"
  - "[code://src/screens.tsx#L688-L710](../../../../src/screens.tsx#L688-L710) - `slashCommands`"
---

## Objective

Every command in the palette slot has a verb.noun id, per [decision 1](../../../decisions/a-command-id-is-its-slash-name-and-reads-verb-noun.md), and a config that binds an old id still works.

## Files

- `UPDATE: src/control.ts` - ids renamed; an `ALIASES` map from old id to new.
- `UPDATE: src/tui.tsx` - a `keys` entry naming an old id is bound to the new one.
- `UPDATE: test/*.test.tsx` - ids the tests type or execute.
- `UPDATE: README.md`, `docs/` - any id they name.

## Steps

1. Draft the rename table (for example `go.automations` to `show.automations`, `session.new` to `new.session`, `automation.remove` to `delete.automation`) and show it to Softov before renaming.
2. Rename, and add every old id to `ALIASES`.
3. Resolve aliases where `keys` is read, so the binding lands on the new id.

## Validation

- A test binds `'ctrl+y': 'go.sessions'` and ctrl+y opens the sessions screen.
- The slash test types `/show.sessions`.
- `npx vitest run` passes.

## Resume

