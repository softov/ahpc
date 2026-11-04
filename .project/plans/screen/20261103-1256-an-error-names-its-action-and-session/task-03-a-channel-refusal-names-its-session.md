---
title: A channel refusal names its session, or stays in the pane
status: done
depends: [task-02-a-refusal-stays-on-its-page.md]
layer: screen
refs:
  - "[code://src/connect.ts#L61-L63](../../../../src/connect.ts#L61-L63) - `sink`, which the screen fills"
  - "[code://src/connect.ts#L99](../../../../src/connect.ts#L99) - `onRefusal`, which drops the URI and writes the bare message"
  - "[code://src/ahp/channels.ts#L323-L333](../../../../src/ahp/channels.ts#L323-L333) - `refuse`, which gives a refusal that no reader claimed to `onRefusal`"
  - "[code://src/ahp/live.ts#L1667-L1691](../../../../src/ahp/live.ts#L1667-L1691) - `reason`, which adds the code to a message that already starts with it"
  - "[code://src/ahp/live.ts#L3346-L3350](../../../../src/ahp/live.ts#L3346-L3350) - `detail`, which opens the channel of the highlighted session"
  - "[code://src/tui.tsx#L453](../../../../src/tui.tsx#L453) - where the screen fills `sink`"
  - "[code://src/screens.tsx#L279-L291](../../../../src/screens.tsx#L279-L291) - the session list reads each row the highlight passes"
---

## Objective

A refusal that no reader claimed shows on the status row only for the open session.
There, it names its action and the session.
A refusal about another session shows only in the detail pane of the session list.
The code of an RPC error shows once in every refusal that `reason` writes.
The session list reads a session only after the highlight stays on it for 300 ms.

## Files

- `UPDATE: src/ahp/live.ts:1667-1691` - `reason` removes the SDK's start with `hostWords`.
- `UPDATE: src/ahp/live.ts` - `onRefusal` takes a kind, `read` or `send`, at each call.
- `UPDATE: src/connect.ts:61-63` - `sink` gets `refused(uri, message, kind)`, which writes the message by default.
- `UPDATE: src/connect.ts:99` - `onRefusal` calls `sink.refused`.
- `UPDATE: src/control.ts` - `Controller.refused(uri, message, kind)` and the action `send`.
- `UPDATE: src/tui.tsx:453` - fill `sink.refused` with `controller.refused`.
- `UPDATE: src/i18n/en/commands.ts` - the name of the action `send`.
- `UPDATE: src/i18n/pt-BR/commands.ts` - the same key in Portuguese.
- `UPDATE: src/i18n/es/commands.ts` - the same key in Spanish.
- `UPDATE: src/screens.tsx:279-291` - the read of the highlighted session waits 300 ms.
- `UPDATE: test/smoke.test.tsx` - the cases in *Validation*.

## Steps

1. In `reason`, pass the message through `hostWords` before the code goes at the end.
2. Give `onRefusal` in `live.ts` a third argument, `kind`.
3. Pass `read` for a refused channel and for `fetchTurns`.
4. Pass `send` for a refused dispatch and for a rejected action.
5. Add `refused(uri, message, kind)` to `sink`, and write the message to standard error by default.
6. Call `sink.refused` from `onRefusal` in `connect.ts`.
7. Add the action `send` to `RefusedAction`, `ACTION_KEYS` and the three catalogues.
8. Write `Controller.refused`, which reads whether the URI is the open session, its chat, or one of its chats.
9. For the open session, draw `refusal` with the action `readSession` for `read` and `send` for `send`.
10. For another session or an `ahp-chat:` channel, draw nothing.
11. For any other channel, draw the message as before.
12. Fill `sink.refused` with `controller.refused` where `tui.tsx` fills `sink.report`.
13. In the session list, start a 300 ms timer when `selected` changes, and call `controller.detail` when it fires.
14. Clear the timer when `selected` changes again or the list closes.

## Validation

- A test: a refused channel of a session that is not open leaves the row empty.
- A test: a refused dispatch on the open session shows `Send, <title>: <reason>`.
- A test: a refused channel that is not a session or a chat shows its message.
- A test: three moves of the highlight inside 300 ms read only the last session.
- A test: `reason` writes `No agent for session (-32001)` for an `RPC error -32001: No agent for session`.
- Run `npm run typecheck` and `npx vitest run`, one after the other, and check that both pass.

## Resume

- Implemented 2026-11-03; awaits review. See [implemented.md](implemented.md).
