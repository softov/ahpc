---
title: The question folds to one line on the history
status: done
depends: []
layer: "screen"
refs:
  - "[code://src/screens.tsx#L1001-L1030](../../../../src/screens.tsx#L1001-L1030) - where `ChatHitl` is drawn"
  - "[code://src/app.tsx#L238-L264](../../../../src/app.tsx#L238-L264) - the hints while an input waits"
---

## Objective

While an input waits and focus is on `chat.transcript`, the chat screen draws a one-line `FoldedQuestion` in place of `ChatHitl`.

## Files

- `UPDATE: src/screens.tsx:1001-1030` - add `FoldedQuestion`, and draw it in place of `ChatHitl` while focus is on the history.
- `UPDATE: src/app.tsx:238-264` - the hints while the line shows a confirmation: `a approve`, `d deny`, `esc back`.
- `UPDATE: src/i18n/en/screens.ts` - the line's text.
- `UPDATE: src/i18n/pt-BR/screens.ts` - the line's text.
- `UPDATE: src/i18n/es/screens.ts` - the line's text.
- `UPDATE: test/smoke.test.tsx` - the cases in *Validation*.

## Steps

1. Read `FOCUS` in the chat screen, and fold while it is `chat.transcript` and an input waits.
2. Draw the line in the warning tone: the glyph, the title, and the hints for its kind.
3. Use the confirmation title for a confirmation, and `textui.hitl.title` for a question.
4. Bind `a` and `d` with a global `useInput` while the line shows a confirmation, as `ConfirmRequest` does.
5. On a click, blur the history so that the panel mounts and its Approve button takes focus.
6. Report the line's place to `boodFloorFor('ask')`, as the panel does.
7. Show `a approve`, `d deny` and `esc back` on the hint row while the line shows a confirmation.
8. Add the cases in *Validation*.

## Validation

- Escape from a waiting confirmation shows the line and not the Approve button.
- `a` on the line approves the confirmation.
- `d` on the line denies the confirmation.
- A click on the line shows the panel, and focus is in `chat.hitl`.
- Focus on the composer shows the panel.
- A waiting question folds to the line with the question's title, and `a` does not approve it.
- With the fold removed, the first case fails.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
