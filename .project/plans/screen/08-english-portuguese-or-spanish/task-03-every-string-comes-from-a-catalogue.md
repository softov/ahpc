---
title: Every string ahpc shows comes from a catalogue
status: done
depends: [task-02-the-language-is-chosen-at-start.md]
layer: "ahpc screen"
refs:
  - "[code://src/control.ts#L1175](../../../../src/control.ts#L1175) - command titles, categories, descriptions, confirm dialogs"
  - "[code://src/screens.tsx](../../../../src/screens.tsx) - screen text, empty states, hints"
  - "[code://src/app.tsx](../../../../src/app.tsx) - hint rows and notices"
  - "[code://src/view/](../../../../src/view/) - the views' own text"
---

## Objective

Every string the TUI shows reads through `app.i18n.t`, with an `en` bundle that holds all of them and `pt-BR` and `es` bundles translated in full, including textui's chrome keys from task 01.

## Files

- `CREATE: src/i18n/en.ts` - every key, English.
- `CREATE: src/i18n/pt-BR.ts` - Brazilian Portuguese.
- `CREATE: src/i18n/es.ts` - Spanish.
- `UPDATE: src/control.ts`, `src/screens.tsx`, `src/app.tsx`, `src/view/*.tsx` - literals become keys.

## Steps

1. Commands first: `command.<id>.title`, `.description`, and categories as `category.<name>`; a command's `keywords` keep the English title so an English search still finds it in any language.
2. Then screens, hints, notices and dialogs, one file at a time.
3. Plurals and numbers through `app.i18n.plural` and `number`, not string building.
4. Translate `pt-BR` and `es`.

## Validation

- A test that every key in `pt-BR` and `es` exists in `en`, and that `en` has no key missing from the code (`rg` over `t('...')`).
- A smoke test opens the palette under `pt-BR` and finds a translated title and heading.
- `npx vitest run` passes; tests that match English text run under `en`.

## Resume

Done 2026-09-30.
`src/i18n/<locale>/{commands,screens,views,textui}.ts`, registered first in `registerChat` and in `registerWire`; 193 command keys, 136 screen keys, 183 view keys, and pt-BR and es for textui's 115.
`test/i18n.test.ts` holds the catalogues to one key set and one set of placeholders, and every key the code asks for to an English message.
Departure: commands carry no `keywords` with the English title; the palette searches ids, which are English noun.verb, so an English search finds a command in any language.
Two English strings changed: "1 files" reads "1 file", and the Changes and Files titles lost a trailing space.
Left English: whatever the host sends (titles, model and harness names, config titles and values, activity lines), protocol values, key chords, CLI output.
Checked with `ahpc --static --lang pt-br` on the sessions and new-session screens.
