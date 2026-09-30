---
title: The language is chosen at start
status: done
depends: []
layer: "ahpc cli"
refs:
  - "[code://src/cli/main.ts#L368](../../../../src/cli/main.ts#L368) - `--theme` over the config, the pattern `--lang` follows"
  - "[code://src/tui.tsx#L372](../../../../src/tui.tsx#L372) - `createApp`, which takes `locale`"
  - "[code://src/config.ts](../../../../src/config.ts) - the config file's settings"
---

## Objective

ahpc starts in the language `--lang` names, else the system's, else English, and hands it to `createApp({ locale })`.

## Files

- `CREATE: src/i18n/locale.ts` - `detectLocale(flag, env)`: the flag, `LC_ALL`, `LC_MESSAGES`, `LANG`, `Intl.DateTimeFormat().resolvedOptions().locale`, then `en`; normalises `pt_BR.UTF-8` and `pt-br` to `pt-BR`; `C` and `POSIX` are `en`; a language not shipped is `en`.
- `UPDATE: src/cli/main.ts` - read `--lang`; list it in the help.
- `UPDATE: src/tui.tsx` - pass `locale` to `createApp`.

## Steps

1. Write `detectLocale` as a pure function of the flag and an env record.
2. Wire it where `--theme` is read, for both the TUI and `ahpc wire`.
3. Add `lang` to the config; `--lang` wins over it.

## Validation

- `test/locale.test.ts`: `pt-br`, `pt_BR.UTF-8`, `es_AR.UTF-8` (to `es`), `C`, `fr_FR.UTF-8` (to `en`), `LC_ALL` over `LANG`, the flag over all of them.
- `npx vitest run` passes.

## Resume

Done 2026-09-30.
`src/i18n/locale.ts` holds `detectLocale` and `shipped`; `src/tui.tsx` and `ahpc wire` pass the result to `createApp` as `locale`, and `lang` is in the config.
`test/locale.test.ts` covers the order, the tag spellings, `C` and a language not shipped.
Nothing is translated yet, so the locale is set and unread until task 01 and task 03.
