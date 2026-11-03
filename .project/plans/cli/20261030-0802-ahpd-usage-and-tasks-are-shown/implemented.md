---
title: A turn's usage and a session's open tasks are shown from ahpd's `_meta` - implemented
date: 2026-10-30
refs:
  - git://188ab98
  - "[code://src/ahp/types.ts](../../../../src/ahp/types.ts)"
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts)"
  - "[code://src/cli/main.ts](../../../../src/cli/main.ts)"
  - "[code://src/cli/render.ts](../../../../src/cli/render.ts)"
  - "[code://src/ahp/fake.ts](../../../../src/ahp/fake.ts)"
---

`session history` prints one line under a turn that reported usage - tokens in and out, the cache counts, reasoning tokens, the price the host charged and how full the context window is - with only the parts the host actually sent. `session show` prints the number of open tasks for a session whose host reports them, and no row at all for one whose host does not. A host that sends none of the new keys prints exactly what it printed before.

## What was built

- `src/ahp/types.ts` - `TurnUsage` gained `cacheWriteTokens` and `reasoningTokens`, `context` `{ used, size }` from `ahpd.context`, and `price` `{ amount, currency }` from `ahpd.cost`, each naming its key; `price` is kept apart from `cost`, which is in credits. The doc comment on `SessionSummary._meta` names `ahpd.tasks` beside `git.branch`.
- `src/ahp/live.ts` - `usage` reads the four keys with the type checks its sibling fields use, keeps a context only when both halves are numbers, and counts a report carrying only these as a usage.
- `src/cli/main.ts` - `usageLine` builds the line from the parts present, naming which half of a cache count a lone number is; `printTurns` prints it under the turn's text when it has anything to say. `session show` prints the `Tasks` row after `Status`.
- `src/cli/render.ts` - `openTasks` reads `_meta['ahpd.tasks'].open` when it is a number, beside the `branch` reader in the same `_meta`.
- `src/ahp/fake.ts` - the seeded turn `t2` carries a full usage report, and `seed()` gained an `openTasks` option; `ahp-session:/1f0a` reports two open tasks.
- `test/meta.test.ts`, `test/cli.test.ts` - the cases in each task's Validation.

## Verified

- `test/meta.test.ts`: 15 tests green, including the four `ahpd.*` keys read into their fields, the same fields absent when the host sends none, a context-only report kept, and half a context dropped.
- `test/cli.test.ts`: 49 tests green, including the history usage line under one turn and under no other, the `Tasks 2 open` row, and no row for a session no task names.
- `test/usage.test.tsx`: 6 tests green; the screen's usage panel is unchanged.
- `npm run typecheck`: clean.
- `npm test`: 825 tests, 824 passed. The one failure is `test/smoke.test.tsx > the composer is the front door > puts where the session runs on a row of its own`, which expects the checkout directory to be named `ahpc` and is at `build-agents-99b61ae4` in this worktree; the same test fails on `main` here, and nothing in this plan touches it.
- By hand against ahpd `main` on 2026-11-03: `session history` printed `in 2 · out 4 · cache 27274/12619 · 0.1066192 USD` under a Claude turn.
- By hand on 2026-11-03, with the tasks plugin: `session show` printed `Tasks 1 open` after the agent added a task.
- Seen on 2026-11-03: the price prints every decimal place the host sends.

## Departures from the plan

- The field-level cases for `usage()` went to `test/meta.test.ts`, where the existing `usage()` cases live, rather than `test/usage.test.tsx`, which renders the usage screen over the fake host and never runs `usage()`; the plan's own Answers table says the screen's panel does not change, so those cases have nothing to observe there.
- The fake host's seeded conversation gained a usage report and a task count, so the CLI cases have a turn to print under and a session with a `Tasks` row; the seed is what the CLI suites are driven against.
- `openTasks` lives in `src/cli/render.ts` beside `branch`, the other `_meta` reader, rather than inline in `main.ts`.
- A cache count with only one half is printed as `cache <n> read` or `cache <n> written` rather than defaulting the missing half to zero.

## Left for later

- None.
