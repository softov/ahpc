---
title: A session list an agent can read
created: 2026-10-13
---

Softov asked on 2026-10-13 whether `session list` pages, as in `ahpc session list --limit 10 --offset 10`. It does not, and on a host with many sessions an agent cannot read the whole answer.

## What is there now

The wire is paged already. The protocol's `listSessions` takes `limit` and `cursor` and answers `nextCursor`. ahpd serves pages, and `listSessions` in `src/ahp/live.ts` follows `nextCursor` to the end. So every caller gets the whole catalogue at once.

The cost is in what an agent reads. On Softov's host, `ahpc session list --json` is about 157 KB for 143 sessions, which is near 40k tokens in one tool result. Three readers hand an agent the full list:

- `ahpc session list`, which a shell agent runs.
- `list_sessions` in ahpc's MCP server (`src/mcp/tools.ts`), which has only an `archived` filter.
- `list_sessions` in ahpd (`packages/sdk/src/tools/session.ts`), which a session on ahpd calls as `mcp__ahp__list_sessions`. It has filters, but no limit.

## The shape

`--limit N` and `--offset N` on `ahpc session list`, and `limit` and `offset` on ahpc's own `list_sessions` tool. The list is newest first, so `--limit 10` is the ten sessions changed last.

ahpc comes first, and ahpd's tool stays as it is for now. VS Code calls `listSessions()` with no page options. So ahpd answers VS Code with the whole list in one page. ahpd's tool copies VS Code's, which also has no limit.

A cut list says so. The JSON carries the total and the offset of the next page, and the table ends with a line such as `10 of 143; --offset 10 for more`. An agent then knows the list is not complete, which is the failure Softov asked about.

The offset counts rows after the filters, on the client. It is not the protocol cursor: a cursor is opaque by contract, and an offset is a number an agent can write.

## Open questions

- **ahpd's tool, later.** A `limit` on ahpd's `list_sessions` is an addition VS Code does not have, so it needs a decision. The other option is to keep parity and make the rows smaller.
- **A default limit.** A default of 50 keeps a careless call small. It also changes the answer to a call with no arguments. The CLI keeps no default.
- **Fewer fields.** One row of ahpd's tool carries git, GitHub and change counts. A `fields` option, or a short row by default, would cut the size without paging.
