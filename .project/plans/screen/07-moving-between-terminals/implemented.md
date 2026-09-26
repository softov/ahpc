---
title: Moving between terminals from the keyboard - implemented
date: 2026-09-26
refs:
  - "[code://src/view/terminal.tsx](../../../../src/view/terminal.tsx) - `TerminalTabs` and the list mode"
  - "[code://src/control.ts](../../../../src/control.ts) - the terminal navigation commands and keys"
---

The terminal screen is navigable from the keyboard: alt+1 to alt+9 jump, tab goes between the command field and the tabs where the arrows step, alt+left and alt+right step from the tabs and the output, and ctrl+l shows the list of terminals, where enter opens one and ctrl+l returns to the current one.

## What was built

- [`code://src/view/terminal.tsx`](../../../../src/view/terminal.tsx) - `TerminalTabs`, a focus stop from one terminal up; the list mode with its own cursor; the command field takes focus as it mounts.
- [`code://src/control.ts`](../../../../src/control.ts) - `terminal.jump`, `terminal.next`, `terminal.previous`, `terminal.list`, `terminal.focusSwitch`.
- [`code://src/app.tsx`](../../../../src/app.tsx) - hint rows for tab mode and list mode.

## Verified

- `npx vitest run` 618 passed; test/smoke.test.tsx holds the navigation cases, the list at 100 and 60 columns.
- Checked by hand by Softov, 2026-09-26.

## Departures from the plan

- None.

## Left for later

- alt+left and alt+right from the command field, which the field keeps for moving a word.
