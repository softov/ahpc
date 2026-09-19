---
title: Telling somebody the version is old - what was built
plan: plans/screen/01-update-check/plan.md
date: 2026-09-18
---

## What exists now

- `src/update.ts`: `newer`, `registry`, `readUpdate`, `stale`, `refreshUpdate`, `checkingUpdates`, `updateNotice`, `updatePath`, `MAX_AGE_MS`. Its header names the copy in ahpd.
- `src/config.ts`: `statePath(tool, file)` and the `updateCheck` key on `Config`.
- `src/version.ts`: `manifest()` answering `{ name, version }`; `version()` wraps it.
- `src/flags.ts`: `--no-update-check` in `SWITCHES`.
- `src/state.ts`: `UPDATE_NOTICE`.
- `src/tui.tsx`: the flag, the key under it, the usage text; `still()` sets the store from the file; `tui()` sets it on open and after each refresh, and schedules `refreshUpdate` when stale and every six hours, `unref()`ed.
- `src/app.tsx`: `ChatStatus` draws a refusal, else the notice in `muted`, else the hints.
- `src/cli/main.ts`: `status` prints the sentence as a third line and carries `update: { latest }` under `--json`, under the same gates with `tty` taken as true.
- `test/update.test.ts` (40 cases), one case in `test/smoke.test.tsx`, three in `test/cli.test.ts`.
- `README.md`: the `status` row, a Configuration row, and "Knowing when it is old".

## What was verified

- `npm run typecheck`, `npm test` (28 files, 534 tests), `npm run build`.
- Against the real registry on 2026-09-19, with the manifest lowered to 0.3.0: the screen writes `latest: 0.4.0`; `status` then says `@softov/ahpc 0.4.0 is on npm, this is 0.3.0` and carries it under `--json`; `--static` draws it from the file; `CI=1` says nothing; `--version` prints `0.3.0` alone.
- By hand against a local registry answering `9.9.9`, the screen under a pty: `status` says two lines with no file; a still writes no file; the screen writes it; `status` then says three lines and the JSON field; each of the gates says two lines; a still draws the sentence from the file; with the registry stopped the old file is untouched; `--version` prints the version alone.
- The `newer` table in `test/update.test.ts` is byte-identical to ahpd's.

## Where it departed from the plan

- `checkingUpdates` and `updateNotice` were written in `update.ts` from the start rather than in `tui.tsx` and moved in task 03.
- `checkingUpdates` takes `(on, env, tty)` rather than the options object, so `update.ts` imports neither front end.
- `updatePath()` lives in `update.ts` over `statePath('ahpc', 'update.json')`, not in `config.ts`.
- The status-row smoke case is one test with three steps rather than two tests.
