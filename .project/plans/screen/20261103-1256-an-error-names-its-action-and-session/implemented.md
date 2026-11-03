---
title: An error on the screen names its action and its session, and stays on that session - implemented
date: 2026-11-03
refs:
  - "[code://src/control.ts](../../../../src/control.ts) - `RefusedAction`, `About`, `refusal`, `failed`, `told`, and the clears in `open` and `close`"
  - "[code://src/screens.tsx](../../../../src/screens.tsx) - each `controller.report` names its action"
  - "[code://test/smoke.test.tsx](../../../../test/smoke.test.tsx) - the -32001 cases and the three scope cases"
---

A refusal on the status row reads `<action>, <session>: <reason>`, or `<action>: <reason>` when it is about no session.
The session is its title from the list, or its URI when the list has no title.
An RPC error shows the host's words and its code once.
Opening or closing a session clears the row, and a refusal that arrives after the page changed is not drawn.

## What was built

- [`code://src/control.ts`](../../../../src/control.ts) - `RefusedAction` lists 24 actions, and `ACTION_KEYS` maps each one to its catalogue key. `About` is `{ action, session? }`.
- `failed(error, about?)` removes the SDK's `RPC error <code>: ` with `hostWords`, adds the code once, and writes the line through `refusal`.
- `told(sending, about)` reads `OPEN` when the action goes, and draws nothing when `OPEN` changed before the answer.
- `open` clears the row, sets `OPEN`, and only then sends "mark as read". Its `detail` catch draws nothing when another page is open.
- `close` clears the row. `disposeSession` reports its refusal after the close and the re-read.
- `Controller.report(error, about?)` passes `about` to `failed`. The 10 calls in [`code://src/screens.tsx`](../../../../src/screens.tsx) name their action, and the session when the read is for one.
- The three catalogues - the two line forms and the 24 action names. The names reuse the command titles where one exists, such as *Open session* and *Dispose session*.
- [`code://test/smoke.test.tsx`](../../../../test/smoke.test.tsx) - the -32001 case and the unqueue case have their new text. Three new cases: a failed open that `close` clears, a late refusal after `close`, and a refused dispose after the close.

## Verified

- `npm run typecheck` clean.
- `npm run build` clean.
- `npx vitest run` - 829 of 829 passed.
- With the `OPEN` check in `told` removed, the late refusal case fails.

## Departures from the plan

- `WRAPPER` is not exported. `hostWords` in [`code://src/ahp/auth.ts`](../../../../src/ahp/auth.ts) already removes it, and the CLI uses it for the same line.
- The `OPEN` check is in `told` and in the `detail` catch, not in `failed`. `failed` has other callers that are not about a page.
- `disposeSession` reports after the re-read too, because a re-read that answers clears the row.
- A declined question is the action `decline`, and a refused create is the action `create`. The plan named neither.
- The case "a refused action on the open session still shows its line" is the existing unqueue case, with its new text.
- The pending checks of screen/09, 10 and 11 quote no refusal, so they did not change.
