---
title: Each subject page shows a picture of its screen
domain: documentation
status: planned
priority: medium
created: 2026-11-03
revalidated: 2026-11-03
refs:
  - git://fd341f0 - the commit of this repository the facts were checked at
  - "[code://docs/subjects/AUTOMATIONS.md#L5-L17](../../../../docs/subjects/AUTOMATIONS.md#L5-L17) - a *Screen* section today: one line on how to open the screen, then a table of keys"
  - "[code://docs/subjects/SESSIONS.md#L5-L7](../../../../docs/subjects/SESSIONS.md#L5-L7) - the session list *Screen* section, which links to the screen page instead of a picture"
  - "[code://docs/use/SCREEN.md#L20](../../../../docs/use/SCREEN.md#L20) - the picture pattern this plan copies: alt text that says what the screen shows, and a path to `../img/`"
  - "[code://docs/img/sessions.svg](../../../../docs/img/sessions.svg) - a still of the session list, 820 by 530, on a `#0d1117` background"
  - "[code://src/tui.tsx#L168-L174](../../../../src/tui.tsx#L168-L174) - the still flags: `--static`, `--width`, `--height` and `--svg`, which write the picture that replaces a placeholder"
---

## Goal

Each subject page that has a *Screen* section shows a picture of that screen.
Today no subject page has one.
This plan gives each page the place for the picture, with a placeholder where no still exists yet.
A still replaces a placeholder by writing over its file, with no change to the page.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `grep -n "## Screen" docs/subjects/*.md` - 9 pages have a *Screen* section at line 5: AGENTS, AUTOMATIONS, CHANGES, CHATS, CUSTOMIZATIONS, RESOURCES, SESSIONS, TERMINALS and TURNS. TELEMETRY has none.
- `grep -rn "img/" docs README.md` - only `README.md` and `docs/use/SCREEN.md` show pictures, all three stills.

### Runtime path

```
docs/subjects/<SUBJECT>.md ## Screen -> ![...](../img/<subject>.svg) -> vitepress build -> the page
```

### Gaps

- No subject page has a picture.
- `docs/img/` has a still for the session list only.

## Answers

| What | Source | Task |
| --- | --- | --- |
| Each subject page with a *Screen* section gets the place for a picture of the screen | Softov, 2026-11-03: "plan a doc section on subjects for screens. like on automations, terminals, customizations, etc. at least the space to put a screenshot of the screen." | 01 |
| TELEMETRY gets no picture | `(defaulted: it has no screen)` | 01 |
| One picture per page | `(defaulted: one place first; a second picture is a later line)` | 01 |
| The picture goes under the `## Screen` heading, before its text | `(defaulted: the reader sees the screen, then its keys)` | 01 |
| A placeholder is an SVG file, `docs/img/<subject>.svg`, which says which screen goes there | `(defaulted: VitePress fails the build on a missing picture, and a still replaces the file by name)` | 01 |
| A placeholder is 820 by 530 on `#0d1117`, as `sessions.svg` is | `(defaulted: a still replaces it with no change in the page layout)` | 01 |
| SESSIONS shows the existing `sessions.svg` | `(defaulted: the still of the session list exists)` | 01 |

## Proposed architecture

- **Data flow** - each page links `../img/<subject>.svg`; the file is a placeholder until a still is written over it.
- **State flow** - none; the site is static.
- **Layer responsibilities** - `docs/subjects/`: the link and the alt text · `docs/img/`: the picture.
- **Source-of-truth files** - the files in `docs/img/`.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - Each subject page has a picture of its screen](task-01-each-subject-page-has-a-picture.md) | todo | - |

## Risks and tradeoffs

- The site shows 8 placeholders until stills replace them - each placeholder names its screen, so a reader knows that a picture is missing.
- A still from the scripted host shows only what the script holds - an empty screen needs a still against a real host.

## Resume state

- **Done so far:** planned 2026-11-03.
- **Next action:** [task-01-each-subject-page-has-a-picture.md](task-01-each-subject-page-has-a-picture.md).
- **Open questions:** none.
- **Watch out for:** `docs/img/sessions.svg` exists and is used by `README.md` and `docs/use/SCREEN.md`; do not write a placeholder over it.

## Final verification checklist

- [ ] `npm run docs:build` passes.
- [ ] Each of the 9 subject pages shows its picture under *Screen* in `npm run docs:dev`.
- [ ] `docs/use/SCREEN.md` and `README.md` show the same three stills as before.
