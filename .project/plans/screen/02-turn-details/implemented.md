---
title: Three corrections to what a chat turn draws - implemented
date: 2026-09-20
refs:
  - code://src/ahp/types.ts - the `roundEnded` part, the per-call edit counts, and the `auth-required` status with its challenge.
  - code://src/ahp/live.ts - `parts()` reads `_meta.kind` and `toolCall()` sums the `fileEdit` diffs and keeps the sign-in challenge.
  - code://src/blocks.ts - the three rows: none for the ended round, the count on the header, and the notice for a call waiting on a sign-in.
  - code://src/screens.tsx - `hitlInput` narrows the pending input for `@textui/chat`, which has no `auth-required` status.
  - code://test/live.test.tsx - the scripted-host cases for all three corrections.
  - code://test/smoke.test.tsx - the block cases for all three corrections.
---

A chat turn now settles cleanly when the host says the round is over, says how many lines its files gained and lost, and shows a tool call that is waiting on a sign-in as its own notice rather than as an ordinary call.

## What was built

- `code://src/ahp/types.ts` - `ResponsePart` gained `roundEnded`, `ToolCall` gained `edits` and `auth`, and `ToolCallStatus` gained `auth-required`.
- `code://src/ahp/live.ts` - `parts()` reads the notification's `_meta.kind` and emits a `roundEnded` part for `responseRoundEnded`; `toolCall()` sums each `fileEdit` result's `diff` onto the call and maps the host's status through an explicit table, keeping the challenge from `call.auth` while the status is `auth-required`.
- `code://src/blocks.ts` - `toBlocks` draws no row for a `roundEnded` part and clears `streaming` on the reasoning or prose block above it, totals the turn's own call edits into `+A -R` on the header's `meta`, and draws an `auth-required` call as one `notice` naming the call and the server.
- `code://src/screens.tsx` - a `hitlInput` helper narrows the pending input before `ChatHitl`, which is the one place the widened status reaches `@textui/chat`.
- `code://test/live.test.tsx` - the scripted-host cases for the ended round, the edit counts and the sign-in challenge.
- `code://test/smoke.test.tsx` - the `blocks` cases for the same three rows.

## Verified

- `test/live.test.tsx`: 18 tests green, including the new `a round the host ended`, `the edits a turn made` and `a call waiting on a sign-in` suites.
- `test/smoke.test.tsx`: 139 tests green, including the five new `blocks` cases.
- `test/customizations.test.tsx`: 12 tests green, so the MCP server state `authRequired` still draws its own `sign in` row.
- `npm test`: 28 files, 544 tests passed.
- `npm run typecheck`: clean.

## Departures from the plan

- `src/screens.tsx` was planned unchanged, but widening `ToolCallStatus` made `PendingInput` no longer assignable to `@textui/chat`'s `ChatPendingInput`, whose `ChatToolCallStatus` has no `auth-required`, so a `hitlInput` helper writes the narrowing out at that boundary instead of casting.
- The header count is appended whenever the turn has a non-zero total, including while the turn still runs; the objective names the completed turn, but the decision table gates the count only on a non-zero total.

## Left for later

- Nothing; every task is done and the plan named nothing to defer.
