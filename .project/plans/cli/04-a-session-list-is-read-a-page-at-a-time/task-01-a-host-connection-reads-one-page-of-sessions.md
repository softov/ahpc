---
title: a host connection reads one page of sessions
status: todo
depends: []
layer: ahp
refs:
  - "[code://src/ahp/connection.ts#L27](../../../../src/ahp/connection.ts#L27) - `listSessions`, beside which the new call goes"
  - "[code://src/ahp/live.ts#L2256-L2290](../../../../src/ahp/live.ts#L2256-L2290) - the request and `summary` mapping to reuse"
  - "[code://src/ahp/fake.ts#L1519](../../../../src/ahp/fake.ts#L1519) - the fake host, which needs the same call"
---

## Objective

`HostConnection.sessionPage({ limit, cursor })` sends one `listSessions` request and returns `{ rows, nextCursor }`.
`listSessions()` does not change.

## Files

- `UPDATE: src/ahp/connection.ts:27` - add `sessionPage(page: { limit?: number; cursor?: string }): Promise<{ rows: SessionSummary[]; nextCursor?: string }>`.
- `UPDATE: src/ahp/live.ts:2256-2290` - the live `sessionPage`, one request with `limit` and `cursor` when given.
- `UPDATE: src/ahp/fake.ts:1519` - the fake `sessionPage`, newest first, with an index as its cursor.
- `CREATE: test/session-page.test.ts` - the live call against a scripted host.

## Steps

1. Write a case: a scripted host answers two items and `nextCursor: "c1"`, and `sessionPage({ limit: 2 })` returns both rows and `c1`.
2. Write a case: `sessionPage({ limit: 2, cursor: "c1" })` sends `limit: 2` and `cursor: "c1"` in the request.
3. Write a case: an answer with no `nextCursor` returns no `nextCursor`.
4. Run the cases and see them fail.
5. Add `sessionPage` to `HostConnection` in `connection.ts`.
6. Add the live `sessionPage` in `live.ts`, and map the items with the same `summary` as `listSessions`.
7. Leave `limit` and `cursor` out of the request when the caller has none.
8. Add the fake `sessionPage` in `fake.ts`, and sort the rows newest first.
9. Run the cases again and see them pass.

## Validation

- `test/session-page.test.ts` passes, and its cases fail without steps 5 to 7.
- `npm run typecheck` exits 0.
- `npx vitest run` passes.

## Resume
