---
title: The name and the logo
status: todo
depends: []
layer: "screen"
refs:
  - "[code://src/screens.tsx#L1127-L1131](../../../../src/screens.tsx#L1127-L1131) - the centred column of the new session screen"
  - "[code://src/i18n/en/views.ts#L123](../../../../src/i18n/en/views.ts#L123) - `views.app.name`"
---

## Objective

The header says `ahpc` in every language.
The new session screen shows the four dots above its title.

## Files

- `UPDATE: src/i18n/en/views.ts:123` - `views.app.name` becomes `ahpc`.
- `UPDATE: src/i18n/pt-BR/views.ts:123` - `views.app.name` becomes `ahpc`.
- `UPDATE: src/i18n/es/views.ts:123` - `views.app.name` becomes `ahpc`.
- `UPDATE: src/screens.tsx:1127-1131` - two lines of dots before the title.
- `UPDATE: test/smoke.test.tsx` - the header cases read `ahpc`, and a case reads the logo.

## Steps

1. Set `views.app.name` to `ahpc` in the three catalogues.
2. Draw a green `.` on one line before the title.
3. Draw a yellow `.`, a blue `∙` and a red `.` on the next line.
4. Centre both lines, so the green dot is above the blue dot.
5. Change the header cases to find `ahpc`.
6. Add a case that reads the four dots, their colours and their places, at both sizes.

## Validation

- The header shows `ahpc` and no `AHPC`.
- The four dots show above "A new session", each in its colour.
- The green dot is in the column of the blue dot, one line above it.
- With the logo removed, the new case fails.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
