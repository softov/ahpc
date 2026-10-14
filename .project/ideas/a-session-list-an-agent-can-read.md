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

## Upstream

Checked on 2026-10-13 against AHP `cb6ba618` and VS Code `origin/main` `50559e744a1`.

- **Sessions are paged in AHP already.** `listSessions` takes `PaginatedParams` and answers `nextCursor`, from AHP #275 and #295, both closed. An issue for session paging asks for what exists.
- **VS Code does not use the pages.** `listSessions()` in `agentHostProtocolClient.ts` sends only `channel` and reads only `items`. The contract allows this: a client that ignores `nextCursor` gets the server's cap. The `list_sessions` tool in `sessionServerTools.ts` has no limit either.
- **The automation catalogue is not paged.** `AutomationState.entries` comes whole in the snapshot of `ahp-automations://`. Only `fetchAutomationRuns` takes a cursor, for run history.
- **AHP #521** asks for paged enumeration of resources in a folder, for file search. It is not about sessions or automations.

So an AHP issue can ask only for the automation catalogue. On Softov's host that is three automations and about 8 KB, so the issue has no measured cost behind it yet.

### A draft issue

Title: Page the automation catalogue

> `listSessions` pages since #295, and `fetchAutomationRuns` pages run history. The automation catalogue does not page. `AutomationState.entries` arrives whole in the snapshot of `ahp-automations://`, and each entry carries its full definition, prompt included.
>
> A client that wants a short list, such as a CLI table or an agent tool, still subscribes and takes every entry. On a host with many automations that is the same cost `listSessions` had before #295.
>
> Would a paged read fit next to the channel? For example a `listAutomations` command with `PaginatedParams`, which returns each entry without its prompt. Clients that want live state keep the channel as it is.
