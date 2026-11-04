---
title: The docs pictures are drawn from a demo host - implemented
date: 2026-11-04
refs:
  - git://a5a02c9 - the main this was built on, with the three plans it requires merged in
  - "[code://tools/pictures.mjs](../../../../tools/pictures.mjs)"
  - "[code://docs/subjects/SESSIONS.md](../../../../docs/subjects/SESSIONS.md)"
  - "[code://DEVELOPER.md](../../../../DEVELOPER.md)"
---

`AHPD_DIR=<ahpd checkout> npm run docs:pictures` draws the 11 pictures in `docs/img/` from ahpd's demo host.
Each of the 9 subject pages with a *Screen* section shows its picture, and no picture names a project, host or person of Softov's.

## What was built

- [`code://tools/pictures.mjs`](../../../../tools/pictures.mjs) - the demo folders, the host, the seed through ahpc's commands, the 11 stills, and the clean-up.
- [`code://package.json`](../../../../package.json) - `docs:pictures`.
- `docs/img/` - `sessions.svg`, `transcript.svg` and `compose.svg` drawn again, and 8 new pictures.
- `docs/subjects/` - a picture line under `## Screen` on AGENTS, AUTOMATIONS, CHANGES, CHATS, CUSTOMIZATIONS, RESOURCES, SESSIONS, TERMINALS and TURNS.
- [`code://DEVELOPER.md`](../../../../DEVELOPER.md) - *Drawing the docs pictures*.

## Verified

- The script wrote the 11 pictures twice, against ahpd's demo host from the branch of its plan, and left no process and no folder behind.
- Each picture was opened and checked against the brief's table.
- `grep -il "brb\|advisor\|softov" docs/img/*.svg` printed nothing.
- `npm run docs:build` passed, and `npx vitest run` passed 922 tests in 48 files.
- The script stops with a sentence without `AHPD_DIR`, and when `/tmp/ahpc-demo` is there already.

## Departures from the plan

- Task 01 - the scratch folder is `/tmp/ahpc-demo`, not a random one. The pictures show the path, so a folder under a home folder named its owner, and a random one changed every picture.
- Task 01 - the host listens on port 9210 when it is free, because the header of a picture shows the address.
- Task 01 - the demo host has one agent. So `agents.svg` shows the new session screen with its agent and model chips, as `compose.svg` does.
- Task 01 - ahpd's demo agent now titles a session from its first `slow` or `fail`. Before, those sessions were drawn as "Notes session".
- Task 02 - the alt text of each picture says what it shows, and SESSIONS keeps the alt text of `docs/use/SCREEN.md`.
