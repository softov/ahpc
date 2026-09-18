---
title: ahpc status prints the notice from the file and never fetches
status: todo
depends: [task-01-update-module.md]
layer: cli
refs:
  - code://src/cli/main.ts#L386-L392 - the `status` case: two lines, or one JSON object under `--json`
  - code://src/tui.tsx - `checkingUpdates` and `updateNotice` from task 02, which this verb shares; if they live in `tui.tsx` they move to `update.ts` so the shell does not import the screen
---

## Objective

`ahpc status` prints `@softov/ahpc <latest> is on npm, this is <current>` as a third line when `update.json` says so and the gates allow, and `ahpc status --json` carries `update: { latest }` in the same case; neither makes a request.

## Files

- `UPDATE: src/update.ts` - `checkingUpdates` and `updateNotice` live here, not in `tui.tsx`, because both front ends call them and `main.tsx` imports neither front end from the other.
- `UPDATE: src/cli/main.ts:386-392` - the third line and the JSON field.

## Steps

1. Move or place `checkingUpdates(options, env, tty)` and `updateNotice(name, current)` in `update.ts`; the shell passes `tty: true` for the TTY gate, because a verb that prints and leaves has decided to print already.
2. `status`: `const notice = checkingUpdates(...) ? updateNotice(...) : null`; under `--json`, `...(notice ? { update: { latest } } : {})`; otherwise `line(notice)` after the session count.
3. `--no-update-check` is already in `SWITCHES` from task 02; the shell's option parser reads it the same way.

## Validation

- `test/cli.test.ts` gains: `status` with a newer `update.json` under a temporary `XDG_CONFIG_HOME` prints the third line and the JSON field; with `CI=1` prints neither; with `--no-update-check` prints neither.
- `npm test` and `npm run typecheck` green.

## Resume

