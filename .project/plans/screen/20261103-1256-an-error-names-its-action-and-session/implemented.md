---
title: An error on the screen names its action and its session, and stays on that session - implemented
date: 2026-11-03
refs:
  - "[code://src/control.ts](../../../../src/control.ts) - `RefusedAction`, `About`, `refusal`, `failed`, `told`, and the clears in `open` and `close`"
  - "[code://src/screens.tsx](../../../../src/screens.tsx) - each `controller.report` names its action"
  - "[code://test/smoke.test.tsx](../../../../test/smoke.test.tsx) - the -32001 cases and the three scope cases"
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts) - `reason`, and the kind at each `onRefusal` call"
  - "[code://src/connect.ts](../../../../src/connect.ts) - `sink.refused`"
---

A refusal on the status row reads `<action>, <session>: <reason>`, or `<action>: <reason>` when it is about no session.
The session is its title from the list, or its URI when the list has no title.
An RPC error shows the host's words and its code once.
Opening or closing a session clears the row, and a refusal that arrives after the page changed is not drawn.
A refusal that no reader claimed shows on the row only for the open session, and the session list reads a row after 300 ms.

## What was built

- [`code://src/control.ts`](../../../../src/control.ts) - `RefusedAction` lists 24 actions, and `ACTION_KEYS` maps each one to its catalogue key. `About` is `{ action, session? }`.
- `failed(error, about?)` removes the SDK's `RPC error <code>: ` with `hostWords`, adds the code once, and writes the line through `refusal`.
- `told(sending, about)` reads `OPEN` when the action goes, and draws nothing when `OPEN` changed before the answer.
- `open` clears the row, sets `OPEN`, and only then sends "mark as read". Its `detail` catch draws nothing when another page is open.
- `close` clears the row. `disposeSession` reports its refusal after the close and the re-read.
- `Controller.report(error, about?)` passes `about` to `failed`. The 10 calls in [`code://src/screens.tsx`](../../../../src/screens.tsx) name their action, and the session when the read is for one.
- The three catalogues - the two line forms and the 24 action names. The names reuse the command titles where one exists, such as *Open session* and *Dispose session*.
- [`code://test/smoke.test.tsx`](../../../../test/smoke.test.tsx) - the -32001 case and the unqueue case have their new text. Three new cases: a failed open that `close` clears, a late refusal after `close`, and a refused dispose after the close.

### Task 03

- [`code://src/ahp/live.ts`](../../../../src/ahp/live.ts) - `reason` removes the SDK's start with `hostWords`, so the code shows once in the pane and in the transcript too.
- Each `onRefusal` call passes a kind. `read` is a refused channel, `fetchTurns`, or an action the client could not apply.
- `send` is a dispatch or a rejected action.
- `RefusalKind` is in [`code://src/ahp/connection.ts`](../../../../src/ahp/connection.ts), next to `Sent`.
- [`code://src/connect.ts`](../../../../src/connect.ts) - `sink.refused(uri, message, kind)` writes the message by default, so a CLI run is as before. [`code://src/tui.tsx`](../../../../src/tui.tsx) fills it with `controller.refused`.
- `Controller.refused` names the action `Read session` or `Send` and the open session, for the open session, its chat and its chats. It drops a listed session and an `ahp-chat:` channel. Any other channel keeps its message.
- [`code://src/screens.tsx`](../../../../src/screens.tsx) - `DETAIL_WAIT_MS` is 300. The list reads the highlighted session when the timer fires, and a new highlight clears the timer.
- The action `send` is in the three catalogues: *Send*, *Enviar*, *Enviar*.
- Tests: a refused read with its kind and the code once, in [`code://test/reconnect.test.ts`](../../../../test/reconnect.test.ts). The drop and name rules, and three highlight moves that read one session, in [`code://test/smoke.test.tsx`](../../../../test/smoke.test.tsx).
- Eight smoke cases that read the pane now wait for `DETAIL_WAIT_MS` through `readPane`.

## Verified

- `npm run typecheck` clean.
- `npm run build` clean.
- `npx vitest run` - 829 of 829 passed.
- With the `OPEN` check in `told` removed, the late refusal case fails.
- Task 03: `npm run typecheck` and `npm run build` clean, and `npx vitest run` - 832 of 832 passed.
- Task 03: with `hostWords` removed from `reason`, with `DETAIL_WAIT_MS` at 0, and with the drop rule removed, each new case fails.

## Departures from the plan

- `WRAPPER` is not exported. `hostWords` in [`code://src/ahp/auth.ts`](../../../../src/ahp/auth.ts) already removes it, and the CLI uses it for the same line.
- The `OPEN` check is in `told` and in the `detail` catch, not in `failed`. `failed` has other callers that are not about a page.
- `disposeSession` reports after the re-read too, because a re-read that answers clears the row.
- A declined question is the action `decline`, and a refused create is the action `create`. The plan named neither.
- The case "a refused action on the open session still shows its line" is the existing unqueue case, with its new text.
- The pending checks of screen/09, 10 and 11 quote no refusal, so they did not change.
- Task 03 found more `onRefusal` calls than it listed: a terminal channel, its four dispatches, a subscription's unknown action, and two setting dispatches. Each got the kind of what it does.
- The session list's `detail` catch still draws on the row. Against a live host, a refused channel makes `detail` answer, not throw, so the catch is only for other failures.
