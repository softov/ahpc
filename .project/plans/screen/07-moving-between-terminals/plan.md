---
title: Moving between terminals from the keyboard
domain: screen
status: built
priority: medium
created: 2026-09-26
revalidated: 2026-09-26
requires: []
changes: []
creates: []
decisions: []
refs:
  - "[code://src/view/terminal.tsx](../../../../src/view/terminal.tsx) - `TerminalTabs` and the list mode"
  - "[code://src/control.ts](../../../../src/control.ts) - `terminal.jump`, `terminal.next`, `terminal.previous`, `terminal.list`, `terminal.focusSwitch` and their keys"
  - "[code://src/screens.tsx](../../../../src/screens.tsx) - `TerminalScreen`, which reads `TERMINAL_LIST`"
  - "[code://src/app.tsx](../../../../src/app.tsx) - the terminal hint rows"
---

## Goal

The terminal screen's tabs could only be clicked.
Now a person moves between terminals from the keyboard: by place, by one either way, from the tabs with the arrows, and through a list of every terminal that ctrl+l opens and closes.

## Reconnaissance

The files read are the `refs` above.

### Searches performed

- `rg -n "handleKey" node_modules/@textui/core/dist/app/app.js` - the focused node sees a key first, then bindings, then tab traversal; so a `tab` binding can choose the stop, and the command field's own alt+left and alt+right (a word at a time) are never offered to a binding while it has the keyboard.

### Gaps

- alt+left and alt+right reach `terminal.previous` and `terminal.next` only from the tabs and the output. From the command field they move a word, and alt+1 to alt+9 or tab then the arrows are the way.

## Decisions locked in

| What | Source | Task |
| --- | --- | --- |
| alt+1 to alt+9 jump, alt+left and alt+right step | Softov, 2026-09-26: "alt+1 to alt+9 to jump to a terminal, and alt+left / alt+right for the previous or next one" | 01 |
| The tabs are a focus stop; tab and shift+tab go between them and the command field; left and right there step | Softov, 2026-09-26: "when on I could use arrow to navigate... tab to go from input to top and from top to input" | 01 |
| ctrl+l shows the list alone, enter opens a terminal back in tab mode, ctrl+l again returns to the current one | Softov, 2026-09-26: "a ctrl+l to change into a list mode... no terminal just the list.. enter opens it" | 01 |
| The tabs show from one terminal up | (defaulted: a row to tab to, and a count, whenever there is a terminal) | 01 |
| No keys for new or close | Softov, 2026-09-26: "leave the others keys as is" | - |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - the keyboard reaches every terminal](task-01-the-keyboard-reaches-every-terminal.md) | done | - |

## Resume state

- **Done so far:** task 01 done 2026-09-26; see [implemented.md](implemented.md).
- **Next action:** none.
- **Watch out for:** the list's `selectedId` is the selection, so the view keeps its own cursor; the command field takes focus as it mounts, which is what lands the keyboard back on it after the list.

## Final verification checklist

- [x] `npx vitest run` passes (618).
- [x] Checked by hand by Softov, 2026-09-26.
- [x] `plans/index.md` updated.
