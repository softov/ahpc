---
title: Enter opens an automation, and r runs it
status: accepted
date: 2026-09-26
refs:
  - "[code://src/control.ts#L2749](../../src/control.ts#L2749) - the `r` binding in the automations scope"
  - "[code://src/screens.tsx#L1574](../../src/screens.tsx#L1574) - `AutomationsScreen`, whose list activates the detail"
---

## Context

Enter on an automation row started a run.
One stray keypress started an agent session nobody asked for, and the row had nowhere to show what the automation says before it runs.

## Options

- **Enter opens the detail pane, `r` runs.** Enter becomes the safe verb, and running is a key somebody has to mean.
- **Enter runs, a separate key opens the detail.** Kept the old habit, and kept the stray run.

## Decision

Enter opens the detail pane, and `r` runs the automation.
Right and left open and close the pane the way they do on the session list.

Source: Softov, 2026-09-26: "also change command enter to open.. r to run.. maybe like sessions ui... arrow left and right? to open on sidebar also".

## Consequences

`r` means refresh on the session list and run on the automations list; the two are separate focus scopes, so neither can fire on the other screen.
