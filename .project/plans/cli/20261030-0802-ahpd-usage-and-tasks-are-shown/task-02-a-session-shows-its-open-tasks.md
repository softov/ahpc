---
title: A session shows its open tasks
status: todo
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
