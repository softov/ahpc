---
title: The header says ahpc, and the new session screen shows the logo
domain: screen
status: active
priority: medium
created: 2026-11-03
revalidated: 2026-11-03
refs:
  - git://260e354 - the commit of this repository the facts were checked at
  - "[code://src/app.tsx#L149](../../../../src/app.tsx#L149) - the header draws `views.app.name` in the accent tone"
  - "[code://src/i18n/en/views.ts#L123](../../../../src/i18n/en/views.ts#L123) - `views.app.name` is `AHPC` in English"
  - "[code://src/i18n/pt-BR/views.ts#L123](../../../../src/i18n/pt-BR/views.ts#L123) - `views.app.name` is `AHPC` in Portuguese"
  - "[code://src/i18n/es/views.ts#L123](../../../../src/i18n/es/views.ts#L123) - `views.app.name` is `Asistente` in Spanish"
  - "[code://src/screens.tsx#L1127-L1131](../../../../src/screens.tsx#L1127-L1131) - the centred column of the new session screen, with the title first"
  - "[code://test/smoke.test.tsx#L1297](../../../../test/smoke.test.tsx#L1297) - the cases that find the header by `AHPC`"
  - npm://@textui/core@^0.9.0 - `fg` takes the ANSI names `green`, `yellow`, `blue` and `red`
---

## Goal

The header names the application `ahpc`.
The new session screen shows a logo of four dots above "A new session".
Softov asked for both on 2026-11-03, and gave the logo as an `echo` with ANSI colours.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `views.app.name` - the header is its only reader.
- `screens.newSession.title` - the new session screen is its only reader.
- `AHPC` in `test/` - four lines in `test/smoke.test.tsx`.

### Gaps

- The Spanish name is `Asistente`, a name the application had before.

## Answers

| What | Source | Task |
| --- | --- | --- |
| The header says `ahpc` | Softov, 2026-11-03: "AHPC on top to ahpc" | 01 |
| The Spanish header says `ahpc` too | `(defaulted: the name of the application is not translated)` | 01 |
| Two lines above the title: a green `.`, then a yellow `.`, a blue `∙` and a red `.` | Softov, 2026-11-03: "on the middle line, before \"a new session\" ... 4 dots each one one color" | 01 |
| The green dot is above the blue dot | `(defaulted: the columns of the echo)` | 01 |
| The ANSI colours, not theme tones | `(defaulted: the colours of the echo, which follow the terminal's palette)` | 01 |
| The logo shows only when its two rows and the three lines fit, so a short terminal keeps the title | `(defaulted: at 60 by 14 the logo alone took the space of the title)` | 01 |

## Proposed architecture

- **State flow** - unchanged.
- **Layer responsibilities** - `src/i18n/*/views.ts`: the name · `src/screens.tsx`: the logo.
- **Source-of-truth files** - [`code://src/screens.tsx`](../../../../src/screens.tsx)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The name and the logo](task-01-the-name-and-the-logo.md) | implemented | - |

## Risks and tradeoffs

- The logo is measured one frame late, so the first frame after a resize can draw it or drop it wrongly.
- The ANSI colours do not change with the theme.

## Resume state

- **Done so far:** task 01 implemented, as [implemented.md](implemented.md) says.
- **Next action:** Softov reviews the pull request, and looks at the new session screen in a terminal.
- **Open questions:** none.
- **Watch out for:** the fake's working directory is also named `ahpc`, so a header case reads the bold accent text.

## Final verification checklist

- [ ] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
- [ ] In a terminal, the header says `ahpc`, and the logo shows above "A new session".
