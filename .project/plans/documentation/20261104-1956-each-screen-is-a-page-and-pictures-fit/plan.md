---
title: Each screen of the client is a page, and the pictures fit what they show
domain: documentation
status: built
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
requires:
  - ahpd host/20261104-1956-the-demo-shell-runs-under-a-pty
refs:
  - git://23a6b0c - the commit of this repository the facts were checked at
  - https://github.com/softov/ahpd/tree/main/.project/plans/host/20261104-1956-the-demo-shell-runs-under-a-pty - the ahpd plan that gives the demo's shells a prompt
  - "[code://docs/use/SCREEN.md](../../../../docs/use/SCREEN.md) - one page for starting, the session list, a session, a new session and the keys"
  - "[code://docs/subjects/SESSIONS.md](../../../../docs/subjects/SESSIONS.md) - the session list's own page, with its picture"
  - "[code://docs/.vitepress/config.mts#L34-L37](../../../../docs/.vitepress/config.mts#L34-L37) - the *Use* sidebar"
  - "[code://src/tui.tsx#L218-L221](../../../../src/tui.tsx#L218-L221) - the still's flags, `--say` and `--screen`"
  - "[code://src/control.ts#L1618](../../../../src/control.ts#L1618) - `app.palette`, the command `ctrl+p` runs"
  - "[code://src/control.ts#L2394](../../../../src/control.ts#L2394) - `harness.choose`, the agent picker"
  - "[code://tools/pictures.mjs](../../../../tools/pictures.mjs) - the picture script"
---

## Goal

*Use* has one page for each screen of the client, and each page gives its own keys.
Softov, 2026-11-04: "`ahpc` with no command opens the screen. But it in fact opens the 'A new session'." and "your problem is you mixed new session ui 'SCREEN'".
The pictures show more data, each at a height that fits it, and two new pictures open the palette and the agent picker.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `grep -rn "use/SCREEN" docs README.md` - linked from `docs/index.md`, `docs/README.md`, `docs/start/GET-STARTED.md`, `docs/reference/CLI.md`, `docs/subjects/SESSIONS.md`, `docs/updates/v0_10.md` and `README.md`.
- `automations.svg` drew 2 automations in 30 rows, with 20 empty rows above the hint row.

## Answers

| What | Source | Task |
| --- | --- | --- |
| `use/SCREEN.md` says how to start the client, that it opens on a new session, and how to move between screens | Softov, 2026-11-04: "It can leave the SCREEN telling about navigation. start and leaving it to a new UI." | 03 |
| `use/NEW-SESSION.md` is the new session screen, with its keys | Softov, 2026-11-04: "New session - tells about new session" | 03 |
| `use/SESSION.md` is a session, with its keys and the composer's editing keys | Softov, 2026-11-04: "Session - tells about 'A session'" | 03 |
| `use/KEYS.md` is `ctrl+p`, `f1`, the keys that work on every screen, and how each screen shows its own | Softov, 2026-11-04: "Keys - tell about ctrl + p. how each ui has its shortcuts." | 03 |
| Each screen's page gives that screen's keys | Softov, 2026-11-04: "each ui tell about its shortcut." | 03 |
| The session list stays on `subjects/SESSIONS.md`, and `SCREEN.md` links to it | Softov, 2026-11-04: "subjects/SESSIONS already exists" | 03 |
| `KEYS.md` shows a picture of the palette open | Softov, 2026-11-04: "with a print with the palette open" | 02, 03 |
| A still takes `--command <id>`, and runs that command before its frame | Softov, 2026-11-04: "Add --command <id> to stills" | 01 |
| `agents.svg` shows the agent picker open | (defaulted: the reason for `--command` beside the palette; it stops repeating `compose.svg`) | 02 |
| The script makes about 5 automations and more changed files | Softov, 2026-11-04: "More data, each picture sized to fit" | 02 |
| Each picture is drawn at a height that fits its content | Softov, 2026-11-04: "More data, each picture sized to fit" | 02 |
| A picture is never shorter than 12 rows | (defaulted: the hint row and a header need room, and a tiny picture reads as a strip) | 02 |
| `updates/v0_10.md` keeps its link to `SCREEN.md` | (defaulted: a release page records what was, and the link still resolves) | - |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - A still runs a command before its frame](task-01-a-still-runs-a-command.md) | done | - |
| [02 - The pictures show more and fit](task-02-the-pictures-show-more-and-fit.md) | done | 01 |
| [03 - Each screen is a page under Use](task-03-each-screen-is-a-page.md) | done | 02 |

## Risks and tradeoffs

- A link to an anchor of `SCREEN.md` that moved, such as `#the-session-list`, stops at the top of the page. Task 03 moves every such link in this repository.

## Resume state

- **Done so far:** built 2026-11-04. See [implemented.md](implemented.md).
- **Next action:** review.
- **Open questions:** none.
- **Watch out for:** `terminals.svg` shows a prompt only once the ahpd plan in `requires` is merged.

## Final verification checklist

- [x] `npm run typecheck`, `npm run build`, `npx vitest run` and `npm run docs:build` pass.
- [x] `AHPD_DIR=<ahpd checkout> npm run docs:pictures` writes every picture, and each one is opened and checked.
- [x] The *Use* sidebar lists Screen, New session, Session, Keys, Commands, Tool server and Recording.
