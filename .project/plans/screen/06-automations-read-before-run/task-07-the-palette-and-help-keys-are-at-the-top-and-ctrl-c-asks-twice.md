---
title: The palette and help keys are at the top, and ctrl+c asks twice
status: done
depends: []
layer: "screen"
refs:
  - "[code://src/app.tsx](../../../../src/app.tsx) - the header's right end and the status row"
  - "[code://src/control.ts](../../../../src/control.ts) - `app.interrupt` and its ctrl+c binding"
  - "[code://src/tui.tsx](../../../../src/tui.tsx) - ctrl+c no longer bound to `app.quit`"
---

## Objective

The header draws `f1 help` and `ctrl+p commands` at its right end when no workspace is there, and the footer hint rows no longer name `ctrl+p`.
ctrl+c keeps `chat.stop` and `terminal.interrupt`; otherwise it runs `app.interrupt`, which sets `QUIT_ARMED` for `QUIT_WINDOW_MS` (800) and quits on a second press inside it. The status row says "ctrl+c again to quit" while armed.

## Validation

- test/smoke.test.tsx: the header carries both hints at 100 and 60 columns and a session with a workspace keeps its name there; one ctrl+c arms and the second quits; a press after the window arms again.
- `npx vitest run` passes.

## Resume

Done 2026-09-26, validated by Softov.
