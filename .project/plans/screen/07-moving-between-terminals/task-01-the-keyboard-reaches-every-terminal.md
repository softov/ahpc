---
title: The keyboard reaches every terminal
status: done
depends: []
layer: "screen"
refs:
  - "[code://src/view/terminal.tsx](../../../../src/view/terminal.tsx) - the tabs and the list"
  - "[code://src/control.ts](../../../../src/control.ts) - the commands and their keys"
---

## Objective

`TerminalTabs` is a focus stop (`terminal.tabs`) where left and right read the neighbouring terminal. `terminal.jump` (alt+1 to alt+9), `terminal.next` (alt+right), `terminal.previous` (alt+left) and `terminal.focusSwitch` (tab, shift+tab) are bound on the terminal screen. `terminal.list` (ctrl+l) toggles `TERMINAL_LIST`, which draws the list alone; enter reads the chosen terminal and returns to tab mode.

## Validation

- test/smoke.test.tsx: alt+3 and alt+1 from the command field; tab to the tabs, the arrows wrapping, alt+right from there, tab back; ctrl+l, down, enter opens the second and ctrl+l twice returns to it, at 100 and 60 columns.
- `npx vitest run` passes.

## Resume

Done 2026-09-26, validated by Softov.
