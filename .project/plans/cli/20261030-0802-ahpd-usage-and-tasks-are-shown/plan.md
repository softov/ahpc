---
title: A turn's usage and a session's open tasks are shown from ahpd's `_meta`
domain: cli
status: planned
priority: medium
created: 2026-10-30
revalidated: 2026-10-30
refs:
  - file:///github/ahp-review/briefs/ahpc-catch-up.md - the brief, "What ahpd serves that ahpc cannot reach"
  - git://30df635 - the ahp-review commit that holds the brief
  - "[code://src/ahp/live.ts#L1200-L1240](../../../../src/ahp/live.ts#L1200-L1240) - `usage`, which reads the protocol's counts and the reference host's `_meta` keys"
  - "[code://src/ahp/types.ts#L511-L531](../../../../src/ahp/types.ts#L511-L531) - `TurnUsage`"
  - "[code://src/ahp/types.ts#L61-L69](../../../../src/ahp/types.ts#L61-L69) - `SessionSummary._meta`, carried and read only for `git.branch`"
  - "[code://src/cli/main.ts#L379-L388](../../../../src/cli/main.ts#L379-L388) - `printTurns`, which prints no usage"
  - "[code://src/cli/main.ts#L1026-L1053](../../../../src/cli/main.ts#L1026-L1053) - `session show`, a table of the session's fields"
  - file:///github/ahpd/docs/sdk/AHP.md - `chat/usage` carries `ahpd.cacheWriteTokens`, `ahpd.reasoningTokens`, `ahpd.context` `{ used, size }` and `ahpd.cost` `{ amount, currency }` in `_meta`
  - file:///github/ahpd/docs/plugins/TASK-LIST.md - a session's `_meta` carries `ahpd.tasks` `{ open }`
  - git://4a658abe - the ahpd commit read
---

## Goal

`session history` prints one usage line under each agent turn: tokens, cost and context, from what the host reported.
`session show` prints the number of open tasks when the host sends one.
A host that sends none of these keys prints what it prints today.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `rg -n "'ahpd\.(cost|reasoningTokens|cacheWriteTokens|context|tasks)'" /github/ahpd/packages/*/src` - the agents write the usage keys on `chat/usage`; the tasks plugin writes `ahpd.tasks` on the session.
- `rg -n "ahpd.durationMs" /github/ahpd/packages/*/src` - it is on a tool call, not on a turn's usage, so this plan does not read it.
- `rg -n "\.usage" src/cli` - the CLI prints no usage; the screen's usage panel reads `TurnUsage`.

### Runtime path

```
chat/usage { _meta } -> usage() -> TurnUsage -> printTurns -> one line per turn
session summary { _meta['ahpd.tasks'] } -> session show -> a "Tasks" row
```

### Gaps

- `usage` reads `_meta.cost` as a number, and ahpd sends `ahpd.cost` as `{ amount, currency }`.
- `usage` does not read `ahpd.reasoningTokens`, `ahpd.cacheWriteTokens` or `ahpd.context`.
- `printTurns` prints no usage.
- `session show` does not read the session's `_meta`.

## Answers

| What | Source | Task |
| --- | --- | --- |
| ahpc shows the turn usage keys and the open task count. | Softov, 2026-10-30, picked "Usage and task list" | 01, 02 |
| Each key is read only when present, and no value is defaulted. | `(defaulted: the rule usage() already follows)` | 01 |
| `ahpd.cost` is kept as `price` `{ amount, currency }`, beside the existing `cost` in credits. | `(defaulted: the two units differ, and one field holds one unit)` | 01 |
| `ahpd.durationMs` is not read. | `(defaulted: ahpd writes it on tool calls, not on a turn)` | - |
| The screen's usage panel does not change. | `(defaulted: the request is for the CLI)` | - |

## Proposed architecture

- **Data flow** - `usage` reads the four `ahpd.*` keys into `TurnUsage`. `printTurns` writes one line from it. `session show` reads `_meta['ahpd.tasks'].open` from the summary.
- **Event flow** - no change.
- **State flow** - no change.
- **Layer responsibilities** - `src/ahp/live.ts` and `src/ahp/types.ts`: read · `src/cli/main.ts`: print.
- **Source-of-truth files** - [`code://src/ahp/types.ts`](../../../../src/ahp/types.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - A turn's usage is printed](task-01-a-turns-usage-is-printed.md) | todo | - |
| [02 - A session shows its open tasks](task-02-a-session-shows-its-open-tasks.md) | todo | - |

## Risks and tradeoffs

- The history output gains a line under agent turns - it is printed only when the turn has usage, and `--json` already carries `usage`.

## Resume state

- **Done so far:** planned 2026-10-30.
- **Next action:** [task-01-a-turns-usage-is-printed.md](task-01-a-turns-usage-is-printed.md).
- **Open questions:** none.
- **Watch out for:** `ahpd.cost` and `_meta.cost` are two keys in two units; do not merge them.

## Final verification checklist

- [ ] `npm run typecheck` and `npm test` pass.
- [ ] Against ahpd, `ahpc session history <uri>` prints a usage line under a Claude turn.
- [ ] Against ahpd with the tasks plugin, `ahpc session show <uri>` prints the open task count.
