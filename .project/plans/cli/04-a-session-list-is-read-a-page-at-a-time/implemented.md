---
title: A session list is read a page at a time - implemented
date: 2026-10-13
refs:
  - git://1567143
  - "[code://src/ahp/connection.ts](../../../../src/ahp/connection.ts)"
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts)"
  - "[code://src/ahp/fake.ts](../../../../src/ahp/fake.ts)"
  - "[code://src/cli/main.ts](../../../../src/cli/main.ts)"
  - "[code://src/mcp/tools.ts](../../../../src/mcp/tools.ts)"
---

`ahpc session list --limit N` prints one page of sessions and the cursor for the next page.
`--cursor` reads the page that cursor names.
The MCP `list_sessions` tool takes `limit` and `cursor` the same way.
The work shipped in 0.9.0.

## What was built

- [`code://src/ahp/connection.ts`](../../../../src/ahp/connection.ts) - `HostConnection.sessionPage`, one page of the host's choosing.
- [`code://src/ahp/live.ts`](../../../../src/ahp/live.ts) - the live `sessionPage`, which sends `limit` and `cursor` to the host.
- [`code://src/ahp/fake.ts`](../../../../src/ahp/fake.ts) - the fake host's `sessionPage`.
- [`code://src/cli/main.ts`](../../../../src/cli/main.ts) - `--limit` and `--cursor` on `session list`, and the `More: --cursor` line.
- [`code://src/mcp/tools.ts`](../../../../src/mcp/tools.ts) - `limit` and `cursor` on `list_sessions`.

## Verified

- `test/session-page.test.ts` has 3 cases, and `test/cli.test.ts` has the page and next-page cases.
- The review passed on 2026-10-13.
- By hand against ahpd on 2026-10-13, `session list --limit 5` printed five rows and the next cursor, and that cursor printed the next five.

## Departures from the plan

- None.

## Left for later

- A default limit on `list_sessions`. It has none, as the idea says.
