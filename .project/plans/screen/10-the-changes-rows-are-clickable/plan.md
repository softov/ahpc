---
title: The scopes and actions on the changes screen are clicked or reached with Tab
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
  - "[code://src/screens.tsx#L1355-L1395](../../../../src/screens.tsx#L1355-L1395) - the scopes row and the actions row, drawn as plain `text` that takes no click and no focus"
  - "[code://src/control.ts#L1823-L1837](../../../../src/control.ts#L1823-L1837) - `changes.scope`, which moves `CHANGE_AT` to the next reachable scope and clears `OPEN_FILE`"
  - "[code://src/control.ts#L1874](../../../../src/control.ts#L1874) - `changes.run`, which takes the operation id as its `operation` argument"
  - "[code://src/control.ts#L3122-L3127](../../../../src/control.ts#L3122-L3127) - the `]` and `x` keys, which stay"
  - "[code://src/ahp/followup.ts](../../../../src/ahp/followup.ts) - `chosenOperations`, the actions a person chooses from"
  - "[code://src/screens.tsx#L1480-L1495](../../../../src/screens.tsx#L1480-L1495) - `PullRequestForm`, where ahpc already draws stock `Button`s"
  - "[code://test/changes.test.tsx](../../../../test/changes.test.tsx) - the changes screen's tests, with the 60-column case"
  - npm://@textui/widgets - `Tabs` (focusable, `onChange`, `disabled` items) and `Button` (`onPress`, `size: 'sm'`)
  - file:///github/ahpapp/src/components/ChangesView.tsx - the reference client draws the scopes and the changeset's operations as controls above the files
---

## Goal

On the changes screen, a person picks a scope and runs an action with the mouse or with Tab and Enter.
Today both rows are labels, and only `]` and `x` act on them.
The keys stay.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "<text" src/screens.tsx` around `ChangesScreen` - both rows are `text` in a `Row`, with no `onClick` and no focus.
- `rg -n "export declare const (Tabs|Button|Toolbar)" node_modules/@textui/widgets/dist` - `Tabs` and `Button` take focus; `Toolbar` takes a click and no focus, so it does not fit.
- `rg -n "app.execute\(" src/screens.tsx` - a screen runs a command with `app.execute(id, args)`.

### Runtime path

```
click or Tab + Enter on a scope tab -> Tabs.onChange(uriTemplate) -> CHANGE_AT, OPEN_FILE cleared -> changesAt -> list
click or Tab + Enter on an action button -> app.execute('changes.run', { operation }) -> the same path as x
```

### Gaps

- None found.

## Decisions locked in

| What | Source | Task |
| --- | --- | --- |
| The actions are stock `Button`s and the scopes are a stock `Tabs`; `x` and `]` stay as keys | Softov, 2026-10-11, asked "How should the two rows on the changes screen work?", answered "Stock buttons and tabs" | 01, 02 |
| A scope that needs a turn is a disabled tab, labelled as today | (defaulted: the row already says the host offers it and this screen cannot reach it) | 01 |
| A button runs `changes.run` with its operation id, so commit and create-pr open the prompt and the form as `x` does | (defaulted: one path for a verb, whatever starts it) | 02 |
| A running or failed action keeps its state in the label | (defaulted: the row says it today) | 02 |
| Tab order is the tabs, the buttons, then the list; the list still takes focus when the screen opens | (defaulted: the list is where a person reads first) | 01, 02 |

## Proposed architecture

- **Data flow** - no new data; both rows read what they read today.
- **Event flow** - `Tabs.onChange` does what `changes.scope` does for one named scope; `Button.onPress` calls `app.execute('changes.run', { operation })`.
- **State flow** - no new store key.
- **Layer responsibilities** - `src/screens.tsx`: the two rows · `src/control.ts`: a scope chosen by name, beside `changes.scope`.
- **Source-of-truth files** - [`code://src/screens.tsx`](../../../../src/screens.tsx)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - the scopes are tabs](task-01-the-scopes-are-tabs.md) | blocked | - |
| [02 - the actions are buttons](task-02-the-actions-are-buttons.md) | implemented | - |

## Risks and tradeoffs

- Two more rows take focus, so Tab from the list now leaves it; Escape and the letter keys keep working because `CHANGES_SCOPE` is the screen's.
- A row of buttons is wider than a row of labels.
  At 60 columns it wraps or truncates, and the list keeps its rows.

## Resume state

- **Done so far:** task 02 is implemented, and task 01 is built and tested except for Enter on a tab.
- **Next action:** answer the question below, then finish [task-01-the-scopes-are-tabs.md](task-01-the-scopes-are-tabs.md).
- **Open questions:**
  - The stock `Tabs` picks a scope with `left` and `right`, and Enter does nothing there.
  - An arrow onto a disabled tab stops there and does not skip it.
  - Does task 01 accept the arrows as its Tab path, or does `Tabs` in textui change first?
- **Watch out for:** `changes.scope` clears `OPEN_FILE` when the scope moves, and a tab must do the same.

## Final verification checklist

- [ ] `npm run typecheck` clean.
- [ ] `npx vitest run` passes, with the new cases in `test/changes.test.tsx`.
- [ ] By hand, in a real terminal at 60 and 100 columns: a click and Tab with Enter both pick a scope and run an action.
- [ ] `plans/index.md` updated.
