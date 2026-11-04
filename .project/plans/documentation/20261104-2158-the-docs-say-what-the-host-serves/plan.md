---
title: The docs say what the host serves, with pictures of its fields, the slash menu and an approval
domain: documentation
status: planned
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
requires:
  - ahpd host/20261104-2158-the-demo-offers-the-usual-fields
refs:
  - git://98e3b14 - the commit of this repository the facts were checked at
  - https://github.com/softov/ahpd/tree/main/.project/plans/host/20261104-2158-the-demo-offers-the-usual-fields - the ahpd plan that gives the demo its name and its fields
  - "[code://docs/use/NEW-SESSION.md](../../../../docs/use/NEW-SESSION.md) - the fields, `/`, and the agents"
  - "[code://docs/use/SESSION.md](../../../../docs/use/SESSION.md) - approving a tool call, with no picture of it"
  - "[code://docs/subjects/CUSTOMIZATIONS.md](../../../../docs/subjects/CUSTOMIZATIONS.md) - one picture today"
  - "[code://src/tui.tsx#L222](../../../../src/tui.tsx#L222) - `--say`, which sends a message rather than typing it"
  - "[code://src/screens.tsx#L1104-L1120](../../../../src/screens.tsx#L1104-L1120) - the composer, its `DRAFT` value and its slash commands"
  - "[code://tools/pictures.mjs](../../../../tools/pictures.mjs) - the picture script"
  - "[code://docs/.vitepress/config.mts#L157](../../../../docs/.vitepress/config.mts#L157) - `themeConfig`, with no logo"
  - https://github.com/softov/ahpd/blob/main/docs/public/logo.svg - ahpd's logo, the four dots ahpc's screen already draws
---

## Goal

The *New session* page explains each field, and says that the host sends the fields and the agents it serves.
The `/` menu leads to *Customizations*, which shows the panel and the menu open.
The *Session* page shows a tool call waiting for approval.
The docs site shows the same logo as ahpd's.
Each one is a row in *Answers*, with Softov's words.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Runtime path

```
tools/pictures.mjs -> ahpc --static --svg --type / --session <uri> -> the composer holds "/" -> the slash menu -> slash.svg
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| *New session* explains each field, and says the host sends them and they differ between hosts | Softov, 2026-11-04: "explain that the fields comes from the server" | 03 |
| The usual fields are named: agent, model, mode, permissions, folder, isolation and branch | Softov, 2026-11-04: "the normal filters are Mode, Folder/Branch, repo, Permissions" | 03 |
| *New session* says the agents (harnesses) are the ones the host serves. No label in the screens changes | Softov, 2026-11-04: "on session we must tell that the harness are served from the server" | 03 |
| `/` in *New session* links to *Customizations* | Softov, 2026-11-04: "when talking about the '/' to leave to customizations" | 03 |
| *Customizations* has two pictures: the panel, and the `/` menu open | Softov, 2026-11-04: "one for the customizations and one with the '/' open" | 02, 03 |
| *Customizations* says the host sends what it lists, and it depends on the host | Softov, 2026-11-04: "tell that those information are sent by the server and depends on the server" | 03 |
| *Session* shows `turns.svg`, a tool call waiting for approval | Softov, 2026-11-04: "on session I'm missing a print for the permission to run a tool" | 03 |
| The docs site uses ahpd's `logo.svg` in the nav and on the home page | Softov, 2026-11-04: "on ahpc can we use the same logo as ahpd?" | 04 |
| A still takes `--type <text>`, which puts text in the composer without sending it | (defaulted: `--say` sends, and the menu shows only while the text is typed) | 01 |
| `compose.svg` is drawn on the `notes-app` repository, so it shows isolation and branch | (defaulted: those two fields appear only for a git folder) | 02 |
| The `/` menu is drawn in an open session | (defaulted: with no session, the menu has only ahpc's own commands) | 02 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - A still types into the composer](task-01-a-still-types-into-the-composer.md) | todo | - |
| [02 - The pictures show the fields and the slash menu](task-02-the-pictures-show-fields-and-slash.md) | todo | 01 |
| [03 - The pages say what the host serves](task-03-the-pages-say-what-the-host-serves.md) | todo | 02 |
| [04 - The docs site shows the logo](task-04-the-docs-site-shows-the-logo.md) | todo | - |

## Risks and tradeoffs

- The menu may open on a key press and not on a value. Task 01 then sends the text as key presses.

## Resume state

- **Done so far:** planned 2026-11-04.
- **Next action:** [task-01-a-still-types-into-the-composer.md](task-01-a-still-types-into-the-composer.md).
- **Open questions:** none.
- **Watch out for:** the fields in `compose.svg` show only once the ahpd plan in `requires` is merged.

## Final verification checklist

- [ ] `npm run typecheck`, `npm run build`, `npx vitest run` and `npm run docs:build` pass.
- [ ] `AHPD_DIR=<ahpd checkout> npm run docs:pictures` writes every picture, and each one is opened and checked.
- [ ] The nav and the home page of the docs site show the logo.
