---
title: textui chrome reads through app.i18n
status: todo
depends: []
layer: "textui widgets, chat"
refs:
  - file:///github/textui/packages/widgets/src/overlay/command-palette.ts - placeholder, hint row, `Asking`, `No match`, `Nothing to choose`, `Choose ...`
  - file:///github/textui/packages/widgets/src/overlay/shared.ts - `hint`, which joins the key hints
  - file:///github/textui/packages/widgets/src/overlay/path-picker.ts - its own hint row
  - file:///github/textui/packages/core/src/runtime/hooks.ts - `useI18n`
---

## Objective

Every string a textui widget or chat component draws on its own reads through `app.i18n.t`, with the English text as the default in textui's own `en` bundle.
An app that registers `pt-BR` entries for those keys sees them; one that registers nothing sees English, as today.

## Files

- `CREATE: packages/widgets/src/i18n.ts` - the `en` bundle for widget chrome, registered when the app starts.
- `CREATE: packages/chat/src/i18n.ts` - the same for chat components.
- `UPDATE: packages/widgets/src/overlay/*.ts` - literals become `i18n.t('textui.palette.placeholder')` and so on.
- `UPDATE: packages/chat/src/*.tsx` - the same.

## Steps

1. `rg` each package for string literals a person reads, and list them; hint words (`move`, `enter run`, `esc close`) are keys too.
2. Name keys `textui.<component>.<what>`, so ahpc's bundles can add them without colliding.
3. Read through `useI18n()` so a component redraws if the locale changes.
4. Release textui.

## Validation

- A test registers a `pt-BR` bundle with one palette key, sets the locale and finds the Portuguese text; without it, the English.
- `pnpm -r test` passes unchanged.

## Resume

