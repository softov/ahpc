---
title: Each screen is a page under Use
status: done
depends: [task-02-the-pictures-show-more-and-fit.md]
layer: "docs"
refs:
  - "[code://docs/use/SCREEN.md](../../../../docs/use/SCREEN.md) - the page split into four"
  - "[code://docs/.vitepress/config.mts#L34-L37](../../../../docs/.vitepress/config.mts#L34-L37) - the sidebar"
---

## Objective

*Use* has Screen, New session, Session and Keys, and each screen's page gives its picture and its keys.

## Files

- `UPDATE: docs/use/SCREEN.md` - starting the client, its flags, that it opens on a new session, and moving between screens.
- `CREATE: docs/use/NEW-SESSION.md` - the new session screen: `compose.svg`, its chips, the workspace, and its keys.
- `CREATE: docs/use/SESSION.md` - a session: `transcript.svg`, the header, find, approving, questions, its keys and the editing keys.
- `CREATE: docs/use/KEYS.md` - `keys.svg`, `ctrl+p`, `f1`, the keys of every screen, the hint row, and changing a key.
- `UPDATE: docs/subjects/SESSIONS.md` - the session list's keys from `SCREEN.md`, and its link to `SCREEN.md` without the old anchor.
- `UPDATE: docs/.vitepress/config.mts:34-37` - the four pages in *Use*.
- `UPDATE: docs/README.md` - the *Use* rows.
- `UPDATE: docs/start/GET-STARTED.md` - the row for the screen.
- `UPDATE: docs/index.md` - the link to the screen, if its words change.
- `UPDATE: README.md` - the links to the *Use* pages.

## Steps

1. Move *A new session* from `SCREEN.md` to `NEW-SESSION.md`, with the keys that work there.
2. Move *A session* from `SCREEN.md` to `SESSION.md`, with its keys and the editing table.
3. Move the session list's text and keys from `SCREEN.md` to `subjects/SESSIONS.md`.
4. Write `KEYS.md` from the global rows of the *Keys* table, with `keys.svg` and the link to changing a key.
5. Keep in `SCREEN.md` the start, the flags, the first screen, and a table of how to reach each screen.
6. Write each key once, on the page of the screen it works on, or on `KEYS.md` when it works everywhere.
7. Add the pages to the sidebar, `docs/README.md`, `GET-STARTED.md` and `README.md`.
8. Move each link to a moved section to its new page.

## Validation

- Run `npm run docs:build`, and check that it passes.
- Run `grep -rn "SCREEN.md#" docs README.md`, and check that each anchor exists.
- Open each *Use* page in `npm run docs:dev`, and check its picture and its keys.

## Resume
