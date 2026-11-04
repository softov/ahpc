---
title: A still waits for the host to answer before it draws - implemented
date: 2026-11-04
refs:
  - git://a5a02c9 - the main this was built on
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts)"
  - "[code://src/ahp/connection.ts](../../../../src/ahp/connection.ts)"
  - "[code://src/tui.tsx](../../../../src/tui.tsx)"
  - "[code://test/still.test.ts](../../../../test/still.test.ts)"
---

A still against a live host now draws what the host answered.
The live connection counts each request and subscribe until it is answered, and a still waits on that count, 10 seconds in all.

## What was built

- [`code://src/ahp/live.ts`](../../../../src/ahp/live.ts) - `counted` wraps `request` and `subscribe` of the first client and of each reconnect client, and `idle(limitMs)` waits for the count to reach zero.
- [`code://src/ahp/connection.ts`](../../../../src/ahp/connection.ts) - `idle?(limitMs): Promise<boolean>` on the seam.
- [`code://src/ahp/fake.ts`](../../../../src/ahp/fake.ts) - `idle` answers `false` at once.
- [`code://src/tui.tsx`](../../../../src/tui.tsx) - `answered(app, host, limitMs)` settles the screen and waits on the host in turns. `still` calls it after it opens the session, and again after it pushes the screen.

## Verified

- `test/still.test.ts`: `idle` answers `false` with nothing open, waits for a held subscribe, and gives up at its limit.
- `test/still.test.ts`: a still of a host that answers 300 ms late lists the files, and fails with no wait.
- `test/still.test.ts`: a still of a host that never answers draws after the cap.
- `npm run typecheck` and `npm run build` passed, and `npx vitest run` passed 901 tests in 45 files.
- Against ahpd's demo host over a git folder, the stills of `changes` and `files` list the files. Before, both drew empty.

## Departures from the plan

- `idle` answers whether something was open, so the loop stops once the host has nothing open.
- `still` also waits before it pushes the screen. The changes screen reads the open session when it mounts, and a screen pushed before `listSessions` answers has no session.
- The wait is `answered` in `tui.tsx`, exported for the test.
