---
title: The client speaks English, Portuguese or Spanish, and its commands are typed verb.noun
domain: screen
status: draft
priority: medium
created: 2026-09-30
revalidated: 2026-09-30
requires: []
changes: []
creates: []
decisions:
  - decisions/a-command-id-is-its-slash-name-and-reads-verb-noun.md
refs:
  - "[code://src/control.ts#L1175](../../../../src/control.ts#L1175) - `commands`, every client command's id, title, category and description"
  - "[code://src/screens.tsx#L688-L710](../../../../src/screens.tsx#L688-L710) - `slashCommands`, which offers a command under its id"
  - "[code://src/tui.tsx#L359-L415](../../../../src/tui.tsx#L359-L415) - where the config's `keys` are read and bound, and `createApp` is called"
  - "[code://src/cli/main.ts#L368](../../../../src/cli/main.ts#L368) - how a flag such as `--theme` wins over the config"
  - "[code://src/config.ts#L38](../../../../src/config.ts#L38) - `keys` in the config file"
  - file:///github/textui/packages/core/src/core/i18n.ts - `I18nRegistry`: bundles, `t()`, fallback to `en`, `Intl` formatting
  - file:///github/textui/packages/core/src/runtime/hooks.ts - `useI18n`, which re-renders on a locale change
  - file:///github/textui/packages/widgets/src/overlay/command-palette.ts - chrome written in English: the placeholder, the hint row, `Asking`, `No match`
  - npm://@textui/core@^0.6.1 - `createApp({ locale })` and `app.i18n`
---

## Goal

A person reads ahpc in English, Brazilian Portuguese or Spanish.
The language comes from `--lang`, or from the system when no flag is given, and anything not translated reads in English.
What is typed after `/` stays the same in every language and says what it does: `show.automations`, not `go.automations`.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above.

### Searches performed

- `rg -ln "i18n|locale" packages/*/src` in textui - core has the registry, the `locale` app option and `useI18n`; no widget and no chat component calls it.
- `rg -n "slashCommands" src` - the slash menu takes the palette slot's commands and shows `command.id` as the typed name.
- `rg -n "'session.new'" src test` - ids appear in the default bindings, in tests and in a person's `keys` config (`'ctrl+y': 'session.new'`).

### Runtime path

```
--lang / LC_ALL / LC_MESSAGES / LANG / Intl -> createApp({ locale }) -> app.i18n.t(key) -> command titles, screen text, textui chrome
```

### Gaps

- textui widgets and chat components have no translated strings; their English is literal in the source.
- ahpc has no message catalogue; every title, description and screen line is a literal.
- Not found: any place ahpc reads the system locale - searched `LANG`, `LC_`, `locale` in `src`.

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| 1 | [A command id is its slash name, and it reads verb.noun](../../../decisions/a-command-id-is-its-slash-name-and-reads-verb-noun.md) | Softov, 2026-09-30 |

| What | Source | Task |
| --- | --- | --- |
| English is the default; pt-BR and es ship now | Softov, 2026-09-30: "en default.. pt-br and es now" | 03 |
| `--lang pt-br` picks the language; without it the system's is used; English when neither is shipped | Softov, 2026-09-30: "--lang pt-br, or if any means possible auto detect language default to english" | 02 |
| The system's language is read from `LC_ALL`, then `LC_MESSAGES`, then `LANG`, then `Intl`; `pt_BR.UTF-8` is `pt-BR`; `C` and `POSIX` are English | (defaulted: the order gettext uses) | 02 |
| textui's widget and chat chrome is translated too, through `app.i18n` with English in the source as the default | Softov, 2026-09-30, asked "How far should i18n reach in this pass?", chose "ahpc + textui chrome" | 01 |
| Plan first, before any of this is built | Softov, 2026-09-30, chose "Plan first via do-spec" | - |

## Proposed architecture

- **Data flow** - one bundle per language in ahpc, `en` complete and the others falling back to it key by key; textui registers its own `en` bundle for its chrome and ahpc adds `pt-BR` and `es` entries for those keys.
- **State flow** - the locale is fixed at start; `app.i18n.locale` holds it.
- **Layer responsibilities** - textui: chrome strings read through `app.i18n.t`, English defaults in its own bundle · ahpc: locale detection, its catalogue, the command ids and their aliases.
- **Source-of-truth files** - `src/i18n/en.ts` (created), [`code://src/control.ts`](../../../../src/control.ts).

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - textui chrome reads through app.i18n](task-01-textui-chrome-reads-through-i18n.md) | todo | - |
| [02 - the language is chosen at start](task-02-the-language-is-chosen-at-start.md) | todo | - |
| [03 - every string ahpc shows comes from a catalogue](task-03-every-string-comes-from-a-catalogue.md) | todo | 02 |
| [04 - command ids read verb.noun](task-04-command-ids-read-verb-noun.md) | todo | - |

## Risks and tradeoffs

- A catalogue key per string makes the source harder to read than a literal - keys are named for what the string is, `command.show.automations.title`, so a key reads as well as the text it stands for.
- A translation drifts when the English changes - a test fails on a key present in `pt-BR` or `es` and missing in `en`, and a key missing from them reads in English, which is visible rather than broken.
- ahpc waits on a textui release for task 01 - tasks 02 to 04 do not need it.

## Resume state

- **Done so far:** nothing. Before this plan, uncommitted: the palette titles were reworded verb-first, the categories merged, the width fits content up to 90, `go.new` removed as a copy of `session.new`; textui's palette gathers each category into one group.
- **Next action:** [task-02-the-language-is-chosen-at-start.md](task-02-the-language-is-chosen-at-start.md), or task 04, which stands alone.
- **Open questions:**
  1. Does the non-interactive CLI (`ahpc ... --json`, errors from `Fault`) get translated too? - proposed: no, it is read by scripts; the TUI only.
  2. Is `lang` also a config file setting beside `theme`? - proposed: yes, with `--lang` winning, as `--theme` does.
- **Watch out for:** the slash menu shows ids, so task 04 changes what tests type; the palette's filter searches titles, so a translated title is what a person searches for, and `keywords` should keep the English words.

## Final verification checklist

- [ ] `npx vitest run` passes in ahpc and `pnpm -r test` in textui.
- [ ] `ahpc --lang pt-br`, `LANG=es_ES.UTF-8 ahpc` and `LANG=C ahpc` checked by hand.
- [ ] A config binding an old id still works.
- [ ] `plans/index.md` updated.
