---
title: The waiting question folds to one line while you read - implemented
date: 2026-11-04
---

## What exists now

- `FoldedQuestion` in `src/screens.tsx` draws one warning-toned line while an input waits and focus is on `chat.transcript`.
- The line is the glyph and the title, then the keys: `· a approve · d deny · click to open` for a confirmation, `· click to open` for a question.
- The title truncates on a narrow terminal, and the keys keep their width.
- `a` and `d` answer a confirmation from the line, through a global `useInput`, as `ConfirmRequest` does.
- A click on the line blurs the history, so `ChatHitl` mounts and its Approve button takes focus.
- The hint row shows `a approve`, `d deny` and `esc back` while the line shows a confirmation.
- The strings are in English, Portuguese and Spanish.

## Verified

- `test/smoke.test.tsx` *folded while you read* has seven cases.
- They check the line and the hint row, the line at 60 columns, `a`, `d`, a click, the composer, and a question.
- With the fold removed, the line, click and question cases fail.
- With the `a` and `d` handler off, the `a` and `d` cases fail.
- With the click doing nothing, the click case fails.
- With the title kept at full width, the 60-column case fails.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass, 851 tests.

## Departures from the plan

- The line reports its place as `boodFloorFor('folded')`, not `'ask'`. `ChatHitl` reports `null` on `'ask'` as it unmounts, and that can come after the line reports.
- While a question is folded, the hint row shows the history's hints, not the question's keys. The question's keys do not work on the line.
- `test/live.test.tsx` *scrolls away* opens at 30 rows, not 40. With the block folded, the conversation fits in 40 rows and the header does not scroll away.
