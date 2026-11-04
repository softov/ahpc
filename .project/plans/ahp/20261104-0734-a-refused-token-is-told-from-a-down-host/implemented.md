---
title: A refused connection token is told apart from a host that is down - implemented
date: 2026-11-04
refs:
  - git://fa2b80923de3592a97f515927cc89ece53124487
  - "[code://src/ahp/refused.ts](../../../../src/ahp/refused.ts)"
  - "[code://src/connect.ts](../../../../src/connect.ts)"
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts)"
  - "[code://src/state.ts](../../../../src/state.ts)"
---

A connection that fails now says which failure it was. A token the host refused is named as refused, and a host that wants one is named as wanting one. A host that is up is named as up. A port that answers nothing is named as unreachable, with the token named as a possible cause. The same sentence reaches the status row while a reconnect is failing, and it goes when the connection comes back.

## What was built

- [`code://src/ahp/refused.ts`](../../../../src/ahp/refused.ts) - `whyNoConnection`, the plain GET behind a failed socket and the sentence for a 401, a 426, another status, or no answer.
- [`code://src/connect.ts`](../../../../src/connect.ts) - the first failure uses that sentence. A failed retry reports it once, a late answer is dropped, and a `connected` state takes the row back through `sink.clear`.
- [`code://src/ahp/live.ts`](../../../../src/ahp/live.ts) - `onRetryFailed`, called with the error from each failed attempt in the reconnect loop.
- [`code://src/state.ts`](../../../../src/state.ts) and [`code://src/tui.tsx`](../../../../src/tui.tsx) - `clearHostError`, wired to `sink.clear`, clears the row only while it still holds that sentence.

## Verified

- `npm run typecheck` and `npm run build` pass.
- `npx vitest run`: 861 tests, 860 pass. The one failure is the known `smoke.test.tsx` case about the folder name, and this tree is `build-agents-eda0f1af`.
- `test/refused.test.ts` (5 tests): 401 with a token, 401 with none, 426, a closed port, and a 500. The request carries `?tkn=` only when there is a token.
- `test/reconnect.test.ts` (83 tests, three new). A failed attempt reaches the caller while the loop still connects. A 401 puts the sentence on the row once, and `connected` takes it back. A sentence that resolves after `connected` is dropped.
- `test/resilience.test.ts` (6 tests, two new): clearing leaves a newer sentence alone, and does not refuse an answer being sent.

## Departures from the plan

- Review fix: clearing is `sink.clear`, a no-op in a shell, instead of `sink.report('')`. A blank report wrote a blank line to stderr and refused an answer in flight with an empty sentence.
- Review fix: the connector tracks whether the connection is back, and drops a sentence that resolves after it. The plain request takes a round trip, so a stale answer could land after the row was cleared.
- Review fix: no token means no `tkn` parameter. A 401 then says the host needs a connection token, instead of refusing one that was never given.
- Review fix: the response body is cancelled once the status is read, so the socket is let go.
- `clearHostError` lives in `src/state.ts` and is assigned to `sink.clear` in `src/tui.tsx`. The rule it applies - clear only while the row still says it - is what the test drives.
- The catch in `src/connect.ts` also needed an import and a `reported` variable beside the `onState` line. The plan named the catch and the state line. The declarations next to them are what those edits need.
- For a 426 and for another status, `<error>` is the HTTP status line, as in `426 Upgrade Required`. A network failure reports its cause, as in `ECONNREFUSED`, rather than `fetch failed`.
- The manual check against ahpd with a wrong token was not run. There is no ahpd in this worktree.

## Left for later

- The manual check in the plan's final checklist, against ahpd with a wrong token.
