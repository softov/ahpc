---
title: A session list pages by the host's cursor, not by an offset
status: accepted
date: 2026-10-13
refs:
  - "[code://src/ahp/live.ts#L2256-L2290](../../src/ahp/live.ts#L2256-L2290) - `listSessions`, which follows `nextCursor` to the end"
  - "[code://src/mcp/tools.ts#L130-L160](../../src/mcp/tools.ts#L130-L160) - the MCP `list_sessions` tool"
---

## Context

An agent that reads `ahpc session list` or the MCP `list_sessions` tool gets every session at once. On Softov's host that is 157 KB for 143 sessions. The protocol already pages `listSessions` with `limit` and an opaque `cursor`.

## Decision

`--limit` and `--cursor` on `ahpc session list`, and `limit` and `cursor` on ahpc's MCP `list_sessions`, go to the host as they are. The answer carries the host's `nextCursor`.

Source: Softov's answer on 2026-10-13 to "For ahpc session paging, which shape should I build?": "--limit and --cursor".

## Consequences

The wire carries one page, not the whole catalogue. An agent cannot jump to a page by number; it walks pages in order. A host that does not page ignores `limit` and answers everything, with no `nextCursor`.

## Options

- `--limit` and `--offset`, counted on the client after the filters. An agent can write an offset, but every call still reads the whole catalogue from the host.
