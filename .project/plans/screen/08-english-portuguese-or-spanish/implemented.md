---
title: The client speaks English, Portuguese or Spanish, and its commands are typed noun.verb - implemented
date: 2026-09-30
refs:
  - "[code://src/i18n/locale.ts](../../../../src/i18n/locale.ts) - `detectLocale` and `shipped`"
  - "[code://src/i18n/index.ts](../../../../src/i18n/index.ts) - `MESSAGES` and `registerMessages`, one file per area and locale"
  - "[code://src/i18n/en/commands.ts](../../../../src/i18n/en/commands.ts) - the command catalogue, with its `screens`, `views` and `textui` siblings"
  - "[code://src/i18n/pt-BR](../../../../src/i18n/pt-BR) - the Brazilian Portuguese bundle"
  - "[code://src/i18n/es](../../../../src/i18n/es) - the Spanish bundle"
  - "[code://src/control.ts#L2781-L2835](../../../../src/control.ts#L2781-L2835) - `RENAMED` and `commandIdFor`, the old ids a config may still name"
  - "[code://src/tui.tsx#L415-L421](../../../../src/tui.tsx#L415-L421) - the startup check and `createApp({ locale })`"
  - "[code://src/cli/main.ts](../../../../src/cli/main.ts) - `--lang`, read where `--theme` is read"
  - "[code://src/config.ts](../../../../src/config.ts) - `lang`, which the flag wins over"
  - "[code://test/locale.test.ts](../../../../test/locale.test.ts) - the order, the tag spellings and the fallback"
  - "[code://test/i18n.test.ts](../../../../test/i18n.test.ts) - one key set and one set of placeholders, and every key the code asks for"
  - "[code://test/keys.test.tsx#L62-L63](../../../../test/keys.test.tsx#L62-L63) - a config binding `go.sessions` reaches `sessions.show`"
  - "npm://@textui/core@^0.7.0 - `t(key, values, fallback)` and the chrome keys the widget bundles read"
---

ahpc starts in `--lang`, else the config's `lang`, else the system's language, else English, and reads English, Brazilian Portuguese or Spanish through `app.i18n`.
Every string the TUI shows comes from a catalogue, a key missing from a translation reads in English, and a config or a chord that names a command's old id still reaches the command, which now reads noun.verb.

## What was built

- [`code://src/i18n/locale.ts`](../../../../src/i18n/locale.ts) - `detectLocale(flag, env)`: the flag, `LC_ALL`, `LC_MESSAGES`, `LANG`, `Intl`, then `en`; `pt_BR.UTF-8` and `pt-br` both normalise to `pt-BR`; `C`, `POSIX` and a language not shipped are `en`.
- [`code://src/i18n/`](../../../../src/i18n) - `MESSAGES` with `en`, `pt-BR` and `es`, one file per area, registered through `registerMessages` before the first command: 193 command keys, 136 screen keys and 183 view keys in English, and pt-BR and es for textui's 115 chrome keys.
- [`code://src/control.ts`](../../../../src/control.ts) - every palette id renamed to noun.verb per [decision 1](../../../decisions/a-command-id-reads-noun-verb.md); `RENAMED` maps the old id to the new, and `commandIdFor` is read where `keys` is bound and in the startup check.
- [`code://src/cli/main.ts`](../../../../src/cli/main.ts), [`code://src/tui.tsx`](../../../../src/tui.tsx), [`code://src/config.ts`](../../../../src/config.ts) - `--lang` and the config's `lang`, with the flag winning, handed to `createApp({ locale })`.
- `@textui/* ^0.7.0` - textui's chrome reads through `app.i18n.t(key, values, fallback)` with English in the source, so a widget with no bundle reads English as before.

## Verified

- [`code://test/locale.test.ts`](../../../../test/locale.test.ts): the order `LC_ALL`, `LC_MESSAGES`, `LANG`, `Intl`; `pt-br`, `pt_BR.UTF-8`, `es_AR.UTF-8` to `es`; `C`, `POSIX` and `fr_FR.UTF-8` to `en`; the flag over all of them.
- [`code://test/i18n.test.ts`](../../../../test/i18n.test.ts): pt-BR and es have every key English has and no other; each message keeps its placeholders; every key the code asks for has an English message, and no English message is never asked for.
- [`code://test/keys.test.tsx`](../../../../test/keys.test.tsx): a config binding `go.sessions` opens the sessions screen, and `/session.` completes the renamed ids.
- `npx vitest run` in ahpc: 34 files, 652 tests green. `npm run typecheck`: clean. The textui half was verified in its own repository, `packages/core/test/i18n.test.ts` and `packages/chat/test/i18n.test.tsx`, and released as `@textui/* 0.7.0`, which `package.json` now pins.
- Checked by hand by Softov: `ahpc --static --lang pt-br` on the sessions and new-session screens.

## Departures from the plan

- The plan's `ALIASES` is `RENAMED` with `commandIdFor`, read in both places the old ids could be named.
- Commands carry no `keywords` holding the English title as task 03 step 1 said: the palette searches ids, which are English noun.verb, so an English search finds a command in any language and the keywords would have been a second copy.
- Two English strings changed while the catalogues were written: `1 files` reads `1 file`, and the Changes and Files titles lost a trailing space.
- Task 01 was done in `/github/textui` and released; the plan's `requires` is satisfied by `@textui/* ^0.7.0`.
- The plan's by-hand checklist named `LANG=es_ES.UTF-8` and `LANG=C`; those spellings are covered by `test/locale.test.ts`, and the recorded hand-check is the pt-BR screen pass above.

## Left for later

- What the host sends stays as the host sent it: titles, model and harness names, config titles and values, activity lines.
- Protocol values, key chords and every non-interactive CLI output stay English, per the decision that only the TUI is translated.
- Textui keeps three things English: form validator messages, which callers pass in; shell and layout names, which are identifiers; and `ChatSessionHead`'s dates, which use the machine's locale through `toLocaleString`. See [deferred.md](deferred.md).
