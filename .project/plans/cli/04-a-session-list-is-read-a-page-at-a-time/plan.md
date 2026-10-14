---
title: A session list is read a page at a time
domain: cli
status: active
priority: medium
created: 2026-10-13
revalidated: 2026-10-13
decisions:
  - decisions/session-list-pages-by-the-host-cursor.md
  - decisions/session-list-filters-a-page-after-it-arrives.md
refs:
  - "[code://src/ahp/connection.ts#L27](../../../../src/ahp/connection.ts#L27) - `HostConnection.listSessions`, the whole catalogue"
  - "[code://src/ahp/live.ts#L2256-L2290](../../../../src/ahp/live.ts#L2256-L2290) - the live `listSessions`, which follows `nextCursor` to the end"
  - "[code://src/ahp/fake.ts#L1519](../../../../src/ahp/fake.ts#L1519) - the fake host's `listSessions`"
  - "[code://src/cli/main.ts#L938-L952](../../../../src/cli/main.ts#L938-L952) - `session list`"
  - "[code://src/mcp/tools.ts#L130-L160](../../../../src/mcp/tools.ts#L130-L160) - the MCP `list_sessions` tool"
  - https://github.com/microsoft/agent-host-protocol/issues/295 - cursor pagination on `listSessions`
---

## Goal

An agent reads the session list one page at a time. `ahpc session list --limit 10` prints ten sessions and the cursor for the next page, and the MCP `list_sessions` tool does the same. A cut list says it is cut. The idea is [a-session-list-an-agent-can-read.md](../../../ideas/a-session-list-an-agent-can-read.md).

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg "listSessions" src` - callers are `cli/main.ts`, `mcp/tools.ts` and `control.ts`. `control.ts` fills the screen's store and keeps the whole catalogue.
- `git grep listSessions origin/main` in VS Code - `agentHostProtocolClient.ts` sends no `limit` and reads only `items`.

### Runtime path

```
ahpc session list --limit N --cursor C -> cli/main.ts sessions -> HostConnection.sessionPage -> listSessions {limit, cursor} -> rows + nextCursor -> table or JSON
```

### Gaps

- `HostConnection` has no call that returns one page and its cursor.
- `session list` and `list_sessions` take no limit and print no cursor.

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| 1 | [A session list pages by the host's cursor, not by an offset](../../../decisions/session-list-pages-by-the-host-cursor.md) | Softov, 2026-10-13 |
| 2 | [A session list filters a page after it arrives](../../../decisions/session-list-filters-a-page-after-it-arrives.md) | (defaulted) |

| What | Source | Task |
| --- | --- | --- |
| Without `--limit`, `session list` reads the whole catalogue as today | the idea: the CLI keeps no default | 02 |
| The screen keeps the whole catalogue | `control.ts` needs every row for the list screen | - |

## Proposed architecture

- **Data flow** - `sessionPage({ limit, cursor })` sends one `listSessions` and returns `{ rows, nextCursor? }`. `listSessions()` stays as it is.
- **Layer responsibilities** - `src/ahp`: one page on the wire · `src/cli` and `src/mcp`: the flags, the filter, and the line that says there is more.
- **Source-of-truth files** - [`code://src/ahp/connection.ts`](../../../../src/ahp/connection.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - a host connection reads one page of sessions](task-01-a-host-connection-reads-one-page-of-sessions.md) | implemented | - |
| [02 - session list and list_sessions take a limit and a cursor](task-02-session-list-and-list-sessions-take-a-limit-and-a-cursor.md) | implemented | 01 |

## Risks and tradeoffs

- ahpd caps a page at 500 rows. A larger `limit` gets 500 and a `nextCursor`, which the output shows.
- A host that does not page ignores `limit`. The answer is the whole list with no cursor, which is correct by the protocol.

## Resume state

- **Done so far:** planned 2026-10-13. Tasks 01 and 02 are implemented on 2026-10-13: `HostConnection.sessionPage` with both hosts, `--limit` and `--cursor` on `session list`, and `limit` and `cursor` on the MCP `list_sessions`.
- **Next action:** Softov approves the merge. The review and the hand check against ahpd passed on 2026-10-13.
- **Open questions:**
  1. A default limit on `list_sessions` - proposed: none for now, as the idea says.
- **Watch out for:** the cursor is opaque. Never parse it, and never keep it after the command exits.
  The typed suite has one failure in `test/smoke.test.tsx` at this commit in this worktree, which is the composer chip drawing the worktree's own directory name.

## Final verification checklist

- [x] `ahpc session list --limit 5` against ahpd prints five rows and a line with the next cursor.
- [x] `ahpc session list --limit 5 --cursor <that cursor>` prints the next five.
- [x] `plans/index.md` updated.
