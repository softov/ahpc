---
title: An automation is read before it is run
status: done
depends: [task-02-a-narrow-catalogue-draws-one-pane.md]
layer: "screen"
refs:
  - "[code://src/screens.tsx](../../../../src/screens.tsx) - where it changed"
---

## Objective

Automation and AutomationRun gain the definition and lifecycle fields; AutomationsScreen draws SessionDetails(automationFields) and AutomationRuns beside the list; enter and right open, left closes, r runs; a run row opens its session; a switched-off automation says paused; event triggers are named.

## Validation

- test/automations.test.tsx: "the automation detail" at 70 and 160 columns, enter does not run, r runs, a run opens its session.
- `npx vitest run` passes.

## Resume

Done 2026-09-26, validated by Softov.
