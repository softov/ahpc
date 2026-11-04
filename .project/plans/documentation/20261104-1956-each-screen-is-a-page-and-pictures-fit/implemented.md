---
title: Each screen of the client is a page, and the pictures fit what they show - implemented
date: 2026-11-04
refs:
  - git://9dad545 - the main this was built on
  - "[code://src/tui.tsx](../../../../src/tui.tsx) - `--command` on a still"
  - "[code://test/still-command.test.ts](../../../../test/still-command.test.ts) - the three tests of `--command`"
  - "[code://tools/pictures.mjs](../../../../tools/pictures.mjs) - more demo data, fitted heights, `keys.svg`"
  - "[code://docs/use/SCREEN.md](../../../../docs/use/SCREEN.md) - start, flags, and moving between screens"
---

*Use* has Screen, New session, Session and Keys, and each screen's page gives its picture and its keys.
A still takes `--command <id>`, and the docs pictures show more data at a height that fits it.

## What was built

- [`code://src/tui.tsx`](../../../../src/tui.tsx) - `--command <id>` runs a command before the frame. An unknown id prints `No command called <id>.` and exits 1.
- [`code://test/still-command.test.ts`](../../../../test/still-command.test.ts) - the palette, the agent picker, and an unknown id.
- [`code://tools/pictures.mjs`](../../../../tools/pictures.mjs) - five automations, four more changed files, two terminal commands, `keys.svg`, and fitted heights.
- `docs/img/` - every picture drawn again, and `keys.svg` new.
- `docs/use/` - `SCREEN.md` cut to start, flags and a table of the screens. `NEW-SESSION.md`, `SESSION.md` and `KEYS.md` are new.
- [`code://docs/subjects/SESSIONS.md`](../../../../docs/subjects/SESSIONS.md) - the session list's text, and every key of its scope.
- The *Use* sidebar, `docs/README.md`, `docs/start/GET-STARTED.md`, `README.md` and `DEVELOPER.md`.

## Verified

- `npm run typecheck` and `npm run docs:build` passed. `npx vitest run` passed 925 tests in 49 files.
- The script wrote the 12 pictures against ahpd's demo host from `host/20261104-1956-demo-shell-pty`. Each picture was rendered and checked.
- `terminals.svg` shows `$ git status --short`, its output, `$ ls src/app` and a prompt.
- `grep -il "brb\|advisor\|softov" docs/img/*.svg` printed nothing.
- Each anchor that a page links to exists, and the built *Keys* and *Screen* pages were opened.

## Departures from the plan

- Task 01 - a command with a required argument opens through `app.ask`, so the palette shows its question. `app.execute` alone would refuse it.
- Task 02 - `agents.svg` shows the model picker (`model.choose`), not the agent picker. The demo host has one agent, so its picker has one row.
- Task 02 - a fitted picture loses its longest run of empty rows, not only the rows above the hint row. The terminal screen's empty rows are above its command field.
- Task 02 - `keys.svg` keeps 30 rows and `agents.svg` 26, because the palette and the picker open over the whole screen.
- Task 03 - `subjects/SESSIONS.md` lists every key of the session list, not only the keys `SCREEN.md` had.
- Task 03 - `SESSIONS.md` said the session list is the first screen. It now says `esc` on a new session opens it.

## Found, not planned

- The *Here* row of a session lists `ahpc` once for each still that opened it, 10 times in `chats.svg`. The merged pictures showed 6. The cause is not found yet.
- `ahpc automation runs` prints nothing against the demo host, while `automation show` lists the run.
