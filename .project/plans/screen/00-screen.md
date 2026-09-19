---
title: Screen - what exists today
domain: screen
revalidated: 2026-09-18
---

The screen is the interactive front end: `ahpc` with no command word opens it.
It is `src/tui.tsx` (options, the config file under them, the terminal), `src/app.tsx` (the application, its surfaces and screens), `src/screens.tsx` and `src/view/` (what each screen draws), `src/control.ts` (what the keys do) and `src/state.ts` (the store keys every screen reads), over the AHP client in `src/ahp/` and the components in `@textui/chat`.
The other front end, the shell in `src/cli/`, is its own domain; `src/config.ts`, `src/flags.ts`, `src/version.ts` and `src/update.ts` are shared by both.

## Packages

- `code://src` - one package, `@softov/ahpc`; entry point `src/main.tsx`, which loads `tui.tsx` or `cli/main.ts` and imports neither.

## Contracts

- `code://src/config.ts#L8-L49` - `Config`, what `~/.config/ahpc/config.json` may say; every key is what a flag would have said.
- `code://src/state.ts` - the store keys (`HOST_ERROR`, `UPDATE_NOTICE`, `INPUT_STATUS`, `SCREEN`, ...) that the surfaces and screens bind to.
- `code://src/flags.ts` - `COMMANDS` and `SWITCHES`, the vocabulary both front ends parse with.

## Runtime path

```
ahpc [flags] -> main.tsx: --version answered, else no command word -> tui(argv)
  -> parse flags, loadConfig('ahpc'), env AHPC_HOST / AHPC_TOKEN under them
  -> not a TTY or --static: still(options), one frame on stdout, exit
  -> createNodeTerminal(), connect(options), createApp()
  -> surfaces: header (ChatHeader), status (ChatStatus); screens: sessions, chat, new, changes, files, ...
  -> ChatStatus draws HOST_ERROR when set, else UPDATE_NOTICE, else the key hints, plus the screen name
```

## Tests

- `code://test/smoke.test.tsx` - the screen opens and draws against the fake host.
- `code://test/keys.test.tsx`, `code://test/send.test.tsx`, `code://test/live.test.tsx` - keys, the composer, a live host.
- `code://test/scenario.ts` - the harness the screen tests drive, with `@textui/testing`.
- `code://test/update.test.ts` - the update check, against a local registry.

## Known gaps

- The tool server's remaining MCP surface is the `mcp` domain's, not this one's; idea [the tool server](../../ideas/the-tool-server.md).
