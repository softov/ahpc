---
title: The header says ahpc, and the new session screen shows the logo - implemented
date: 2026-11-03
refs:
  - "[code://src/screens.tsx](../../../../src/screens.tsx) - `Invitation`, the middle of the new session screen"
  - "[code://src/i18n/en/views.ts#L123](../../../../src/i18n/en/views.ts#L123) - `views.app.name`, the same in Portuguese and Spanish"
  - "[code://test/smoke.test.tsx](../../../../test/smoke.test.tsx) - the header cases, the logo case and the short terminal case"
---

The header says `ahpc` in English, Portuguese and Spanish.
The new session screen shows the four dots above "A new session" when five rows fit.

## What was built

- [`code://src/screens.tsx`](../../../../src/screens.tsx) - `Invitation` draws the logo, the title and the two lines. It reads its height with `useMeasure`, and draws the logo only from 5 rows.
- The catalogues - `views.app.name` is `ahpc`. Spanish said `Asistente` before.
- [`code://test/smoke.test.tsx`](../../../../test/smoke.test.tsx) - the header cases read the bold accent `ahpc`, because the fake's working directory is named `ahpc` too. The logo case reads the colours and the places at 100 by 30 and 76 by 20. A case at 60 by 14 reads the title and no logo.

## Verified

- `npm run typecheck` and `npm run build` clean.
- `npx vitest run` - 841 of 841 passed.
- With the logo removed, the two logo cases fail.
- With the guard removed, the case at 60 by 14 fails.
- With `AHPC` back in English, four header cases fail.
- The screen was drawn at 100 by 30, 76 by 20, 60 by 16 and 60 by 14. At 60 by 16 and 60 by 14 it is the same as before.

## Departures from the plan

- The logo gives way on a short terminal, because at 60 by 14 it took the place of the title.
