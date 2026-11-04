---
title: The docs say what the host serves, with pictures of its fields, the slash menu and an approval - implemented
date: 2026-11-04
refs:
  - git://f1f290c - the main this was built on
  - "[code://src/tui.tsx](../../../../src/tui.tsx) - `--type` on a still"
  - "[code://test/still-type.test.ts](../../../../test/still-type.test.ts) - the two cases of `--type`"
  - "[code://tools/pictures.mjs](../../../../tools/pictures.mjs) - `compose.svg` on a repository, and `slash.svg`"
  - "[code://docs/use/NEW-SESSION.md](../../../../docs/use/NEW-SESSION.md) - the agent and the fields"
---

*New session* says the host serves the agents and the fields, with a table of the usual fields.
*Customizations* shows the panel and the slash menu, and *Session* shows a tool call that waits for approval.
The docs site shows ahpd's logo in the nav and on the home page.

## What was built

- [`code://src/tui.tsx`](../../../../src/tui.tsx) - `--type <text>` leaves text in the composer, unsent, after the session opens.
- [`code://test/still-type.test.ts`](../../../../test/still-type.test.ts) - the text shows unsent, and `/` opens the slash menu.
- [`code://tools/pictures.mjs`](../../../../tools/pictures.mjs) - `compose.svg` on `notes-app` with `--path` and `--trust`, and `slash.svg` with `--type /`.
- `docs/img/` - every picture drawn again, and `slash.svg` new.
- `docs/use/NEW-SESSION.md` - *The agent*, *The fields*, and `/` linked to the slash menu.
- `docs/subjects/CUSTOMIZATIONS.md` - the host sends what the panel lists, and *The slash menu* with `slash.svg`.
- `docs/use/SESSION.md` - `turns.svg` beside the approval keys.
- `docs/subjects/AGENTS.md` - the host serves the agents, and a link to the slash menu.
- `docs/public/logo.svg`, `docs/.vitepress/config.mts` and `docs/index.md` - the logo.

## Verified

- `npm run typecheck` and `npm run docs:build` passed. `npx vitest run` passed 927 tests in 50 files.
- The script wrote the 13 pictures against the ahpd plan's branch, and `compose.svg` and `slash.svg` were opened and checked.
- `grep -il "brb\|advisor\|softov" docs/img/*.svg` printed nothing.
- The built home page, *New session* and *Customizations* were opened, with the logo in the nav and the hero.

## Departures from the plan

- Task 01 - setting the draft opens the menu, because the composer draws its menu from its value. No key presses were needed.

## Found, not planned

- In a session, the field row shows `no workspace` for a session in `notes-app`.
- The *Here* row lists `ahpc` once for each still, as the last plan found.
