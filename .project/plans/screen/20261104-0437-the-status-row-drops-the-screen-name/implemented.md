---
title: The status row does not end with the screen's name - implemented
date: 2026-11-04
---

## What exists now

- The status row draws the hints or the host's sentence, and nothing after them.
- `Status` in `src/app.tsx` no longer reads `SCREEN`.

## Verified

- `test/smoke.test.tsx` checks the sessions and chat screens at both sizes: no text on them is the screen's name.
- With the name put back on the row, that case fails at both sizes.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass, 844 tests.

## Departures from the plan

- The case checks the sessions and chat screens, not the changes screen. The `Status` component is the same on every screen.
