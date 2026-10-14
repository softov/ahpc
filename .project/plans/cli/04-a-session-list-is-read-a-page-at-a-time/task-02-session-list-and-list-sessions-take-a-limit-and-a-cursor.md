---
title: session list and list_sessions take a limit and a cursor
status: implemented
depends: [task-01-a-host-connection-reads-one-page-of-sessions.md]
layer: cli
refs:
  - "[code://src/cli/main.ts#L938-L952](../../../../src/cli/main.ts#L938-L952) - `session list`"
  - "[code://src/mcp/tools.ts#L130-L160](../../../../src/mcp/tools.ts#L130-L160) - the MCP `list_sessions` tool"
---

## Objective

`ahpc session list --limit N [--cursor C]` prints one page.
When there is more, the table ends with `More: --cursor <C>`, and the JSON is `{ sessions, nextCursor }`.
The MCP `list_sessions` takes `limit` and `cursor` and answers `{ sessions, nextCursor }` when either is given.
Without `--limit` or `--cursor`, both read the whole catalogue as today.

## Files

- `UPDATE: src/cli/main.ts:938-952` - `--limit` and `--cursor` on `session list`, through `sessionPage`.
- `UPDATE: src/mcp/tools.ts:130-160` - `limit` and `cursor` in the input schema, through `sessionPage`.
- `UPDATE: test/cli.test.ts` - cases for one page, the next page and the last page.
- `UPDATE: test/mcp.test.ts` - the same cases for `list_sessions`.

## Steps

1. Write a case: against the fake host with five sessions, `session list --limit 2` prints two rows and a `More: --cursor` line.
2. Write a case: the cursor from that line prints the next two rows.
3. Write a case: the last page prints no `More:` line.
4. Write a case: `session list --limit 2 --json` prints `{ sessions, nextCursor }`.
5. Write a case: `session list --limit 0` exits 2 with a sentence that the limit is a positive number.
6. Write the same page cases for `list_sessions` with `limit` and `cursor`.
7. Run the cases and see them fail.
8. In `sessions`, call `sessionPage` if the command has `--limit` or `--cursor`, and `listSessions` if not.
9. Apply the archived filter to the page, as the decision on filters says.
10. Print `More: --cursor <C>` after the table when `nextCursor` is present.
11. In `list_sessions`, add `limit` as a positive integer and `cursor` as a string to the input schema.
12. Answer `{ sessions, nextCursor }` if the input has `limit` or `cursor`, and the plain list if not.
13. Add `--limit` and `--cursor` to the help text of `session list`.
14. Run the cases again and see them pass.

## Validation

- The new cases pass, and they fail without steps 8 to 12.
- `npm run typecheck` exits 0.
- `npx vitest run` passes.
- By hand against ahpd: `ahpc session list --limit 5`, then the printed cursor, prints the next five.

## Resume

`ahpc session list` takes `--limit` and `--cursor`.
It calls `sessionPage` when either is given and `listSessions` when neither is.
The archived filter and the sort run on the page.
The table ends with `More: --cursor <C>` when the host sent a cursor.
Under `--json` a page is `{ sessions, nextCursor }` and the whole catalogue stays a plain array.
The MCP `list_sessions` takes `limit` and `cursor` and answers the same two shapes.
`test/cli.test.ts` holds six cases in `ahpc session list, a page at a time`, and `test/mcp.test.ts` holds four beside the session tools.

What the plan did not know.
The `Schema` type in `src/mcp/tools.ts` had no `integer` in its type union, so it gained one word.
A `--limit` that is not a positive whole number is refused before the host is reached, next to the `--trust` refusal.
That is where this codebase's usage mistakes exit 2.
The task's Files list does not name `README.md`, and the Sessions table there gained `--limit` and `--cursor`, which is how `--trust` was added.
A page can hold fewer rows than the limit once the filter has run.
The last page says nothing about more only because the host sent no cursor, which is the decision on filters.
An empty page that still has a cursor keeps the table and the `More:` line.
It does not say `No sessions.`, so a cut list never reads as a whole one.
`npm run typecheck` is clean, and the typed suite has the one `test/smoke.test.tsx` failure this worktree already had.
