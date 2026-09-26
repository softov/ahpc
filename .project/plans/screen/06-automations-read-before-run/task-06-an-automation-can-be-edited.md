---
title: An automation can be edited
status: done
depends: []
layer: "screen"
refs:
  - "[code://src/screens.tsx](../../../../src/screens.tsx) - where it changed"
---

## Objective

Automation.definition carries the held definition; automation.edit (e, gated on the update operation) opens the form on it through AUTOMATION_EDIT; Save dispatches automation/updateRequested with title, message, session and triggers, each built from the held field so unknown entries survive; on/off moves to o.

## Validation

- test/automations.test.tsx: e opens the form filled in, a saved change keeps _meta, the custom agent, the trigger id and the misfire policy, and e does nothing without update.
- `npx vitest run` passes.

## Resume

Done 2026-09-26, validated by Softov.
