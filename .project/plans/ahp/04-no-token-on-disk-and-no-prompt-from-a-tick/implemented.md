---
title: Keep resource tokens out of recordings, and keep a dismissed sign-in prompt dismissed - implemented
date: 2026-09-26
refs:
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts)"
  - "[code://src/control.ts](../../../../src/control.ts)"
  - "[code://test/conformance.test.ts](../../../../test/conformance.test.ts)"
  - "[code://test/auth.test.tsx](../../../../test/auth.test.tsx)"
---

A recording made with `--wire` or `AHPC_RECORD` writes `[redacted]` where an `authenticate` frame carried its token, and a dismissed sign-in prompt stays closed until the person presses `r`, `ctrl+r` or runs the refresh from the palette.

## What was built

- `code://src/ahp/live.ts` - `redacted`, called in `tee` between the parse and the append.
- `code://src/control.ts` - `reread` calls the host without `guard`; `refresh(ask = false)` goes through `guard` only when asked; `session.refresh` and `openLink` ask.
- `code://src/app.tsx` - the first read at start-up asks, so a host that wants a token says so once, on the way in.

## Verified

- `code://test/conformance.test.ts` - the recording holds `[redacted]` and not the token; fails with the call removed.
- `code://test/auth.test.tsx` - after Escape, a refused reread from a catalogue tick and a plain `refresh()` leave the prompt closed, and `ctrl+r` opens it; fails with the old guarded reads.
- `npm test` - 31 files, 620 tests, green. `npx tsc` green.

## Departures from the plan

- None. The plan was written alongside the change.
