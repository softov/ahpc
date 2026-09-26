---
title: The prompt is a paragraph
status: done
depends: []
layer: "screen"
refs:
  - "[code://src/screens.tsx](../../../../src/screens.tsx) - where it changed"
---

## Objective

The Says field becomes Prompt, a TextArea with maxRows 4; the message is sent with origin kind automation.

## Validation

- test/automations.test.tsx: the form still fits 24 rows at 60 and 90 columns with Prompt on it.
- `npx vitest run` passes.

## Resume

Done 2026-09-26, validated by Softov.
