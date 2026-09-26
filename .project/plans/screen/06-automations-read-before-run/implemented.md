---
title: An automation is read before it is run, and the changes screen follows the session - implemented
date: 2026-09-26
refs:
  - "[code://src/control.ts](../../../../src/control.ts) - `forgetChanges`, the automation commands and `app.interrupt`"
  - "[code://src/screens.tsx](../../../../src/screens.tsx) - `SessionsScreen`, `ChangesScreen`, `NewAutomationScreen`, `AutomationsScreen`"
  - "[code://src/view/automations.tsx](../../../../src/view/automations.tsx) - the detail fields and the runs list"
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts) - automation decoding and `updateAutomation`"
  - "[code://src/app.tsx](../../../../src/app.tsx) - the header's key hints and the status row"
---

An automation is read before it runs: enter or right opens a pane with its prompt, directory, harness, model, settings, schedule, missed-run policy, next run and each past run with why it failed, and a run opens the session it started.
`r` runs, `e` edits, `o` switches it on or off.
The form asks harness, model, the model's settings and the host's session settings, takes the prompt as a paragraph, and an edit keeps every field the form does not draw.
The changes screen shows the open session's changeset, a narrow session list gives the screen to the detail pane while it is out, the palette and help keys sit at the header's right end, and ctrl+c quits only on a second press.

## What was built

- [`code://src/control.ts`](../../../../src/control.ts) - `forgetChanges` in `open()` and `close()`; `automation.openDetails`, `automation.closeDetails`, `automation.edit`; `app.interrupt` behind ctrl+c.
- [`code://src/screens.tsx`](../../../../src/screens.tsx) - the pane-alone rule on both list screens; the automation pane; the form's pickers and edit mode.
- [`code://src/view/automations.tsx`](../../../../src/view/automations.tsx) - `automationFields`, `runLine`, `nextOf`, `since`, `AutomationRuns`.
- [`code://src/ahp/live.ts`](../../../../src/ahp/live.ts) - the definition, session template, event triggers, misfire policy, timestamps and run errors decoded; `updateAutomation`.
- [`code://src/app.tsx`](../../../../src/app.tsx) - `f1 help` and `ctrl+p commands` in the header, "ctrl+c again to quit" on the status row.

## Verified

- `npx tsc --noEmit -p tsconfig.json` clean; `npx vitest run` 614 passed.
- test/changes.test.tsx, test/automations.test.tsx and test/smoke.test.tsx hold the new cases, at two widths where layout is involved.
- Checked by hand by Softov, 2026-09-26.

## Departures from the plan

- Tasks 05 to 07 were added to the plan as they were asked for.

## Left for later

- Older runs through `fetchAutomationRuns`, templates, a live changeset, rename, and the rest of [the review's list](../../../review/2026-09-26-before-launch.md).
