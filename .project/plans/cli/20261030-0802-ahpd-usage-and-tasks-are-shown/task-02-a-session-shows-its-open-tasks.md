---
title: A session shows its open tasks
status: implemented
depends: []
layer: "cli"
refs:
  - "[code://src/cli/main.ts#L1026-L1053](../../../../src/cli/main.ts#L1026-L1053) - `session show`"
  - "[code://src/ahp/types.ts#L61-L69](../../../../src/ahp/types.ts#L61-L69) - `SessionSummary._meta`"
---

## Objective

`session show` prints a `Tasks` row with the open count when the summary's `_meta['ahpd.tasks'].open` is a number.

## Files

- `UPDATE: src/cli/main.ts:1040-1050` - add the `Tasks` row as `<n> open`, after `Status`.
- `UPDATE: src/ahp/types.ts:61-69` - the doc comment names `ahpd.tasks` beside `git.branch`.
- `UPDATE: test/cli.test.ts` - the cases in *Validation*.

## Steps

1. Read `_meta['ahpd.tasks'].open` from the summary row, only when it is a number.
2. Add the `Tasks` row, which the table drops when it is empty.
3. Update the doc comment on `_meta`.
4. Add the tests.

## Validation

- `test/cli.test.ts`: a session whose summary has `ahpd.tasks: { open: 2 }` shows `Tasks  2 open`.
- `test/cli.test.ts`: a session with no `ahpd.tasks` shows no `Tasks` row.
- `npm test` passes.

## Resume

`openTasks` at `src/cli/render.ts:76` reads `_meta['ahpd.tasks'].open` when it is a number and answers `<n> open`, otherwise an empty cell; it sits beside `branch`, which is the other `_meta` reader.
`session show` at `src/cli/main.ts:1086` carries the `Tasks` row after `Status`, and the table's empty filter drops it for a session no task names.
The doc comment on `SessionSummary._meta` at `src/ahp/types.ts:61-69` now names `ahpd.tasks` beside `git.branch`.
`test/cli.test.ts` has the two cases, against the seeded session `ahp-session:/1f0a` (`src/ahp/fake.ts:826`, `openTasks: 2`) and `ahp-session:/6b21`, which has none.

Departures: the reader lives in `src/cli/render.ts` beside `branch` rather than inline in `main.ts`, because the summary's `_meta` is read there for both rows.
`seed()` in the fake host gained an `openTasks` option so a seeded summary can carry the key the way the plugin sends it.
