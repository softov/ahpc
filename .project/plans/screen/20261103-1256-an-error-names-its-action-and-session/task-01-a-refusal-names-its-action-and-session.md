---
title: A refusal names its action and its session
status: done
depends: []
layer: screen
refs:
  - "[code://src/control.ts#L484-L498](../../../../src/control.ts#L484-L498) - `failed` and `told`, which gain `about`"
  - "[code://src/ahp/auth.ts#L23-L24](../../../../src/ahp/auth.ts#L23-L24) - `WRAPPER`, to export and reuse"
  - "[code://test/smoke.test.tsx#L1859-L1891](../../../../test/smoke.test.tsx#L1859-L1891) - the -32001 test, whose text changes"
---

## Objective

Each refusal that `failed`, `told` or `Controller.report` draws starts with the action that failed and, when there is one, the session.
The code of an RPC error shows once.

## Files

- `UPDATE: src/control.ts:484-498` - `failed` and `told` take `about`; a `refusal` function writes the line.
- `UPDATE: src/control.ts:87` - `report(error, about?)`.
- `UPDATE: src/control.ts` - each `failed` and `told` call that sends or reads for a session names its action and session.
- `UPDATE: src/screens.tsx` - each `controller.report` call names its action, and its session when it has one.
- `UPDATE: src/ahp/auth.ts:23-24` - export `WRAPPER`.
- `UPDATE: src/i18n/en/commands.ts` - the action names and the two forms of the line.
- `UPDATE: src/i18n/pt-BR/commands.ts` - the same keys in Portuguese.
- `UPDATE: src/i18n/es/commands.ts` - the same keys in Spanish.
- `UPDATE: test/smoke.test.tsx:1883` - the -32001 line with its action and session.
- `UPDATE: test/smoke.test.tsx` - a case for a refused `told` action with the prefix.

## Steps

1. Add the type `About` as `{ action: string; session?: SessionUri }` in `src/control.ts`.
2. Write `refusal(about, reason)`, which returns `<action>, <session>: <reason>` or `<action>: <reason>` through the catalogue.
3. Name the session by its `title` from `sessions(app.store)`, and by its URI when the title is empty.
4. In `failed`, strip `WRAPPER` from the message and add ` (<code>)` once.
5. In `failed`, pass the line through `refusal` when the caller gives `about`.
6. Give `told` an `about` argument, and pass it to `failed`.
7. Name the action and session at each `told` call.
8. Use the actions mark as read, mark as unread, queue, unqueue, stop, allow, deny, answer, archive and unarchive.
9. Name the action and session at the `failed` calls of `open`'s `detail`, `createChat`, `disposeChat` and `disposeSession`.
10. Name the action at the `failed` calls of `reread` and `refresh`, with no session.
11. Leave the `openLink` refusals as they are.
12. Name the action at each `controller.report` call in `src/screens.tsx`, with the session when the read is for one.
13. Add the action names and the two line forms to the three catalogues.

## Validation

- `test/smoke.test.tsx` holds the -32001 case with its new text.
- `test/smoke.test.tsx` holds a refused `told` action that shows its action and session title.
- `test/i18n.test.ts` passes, so the three catalogues have the same keys.
- Run `npm run typecheck` and `npx vitest run`, one after the other, and check that both pass.

## Resume

- Implemented 2026-11-03; awaits review. See [implemented.md](implemented.md).
