---
title: The docs pictures are drawn from a demo host
domain: documentation
status: planned
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
requires:
  - screen/20261104-1621-a-still-waits-for-the-host
  - screen/20261104-1621-the-provider-is-the-hosts-first-agent
  - cli/20261104-1621-automations-are-made-from-the-shell
refs:
  - git://e8c5a80 - the commit the facts were checked at, and the last commit that holds briefs/doc-pictures-come-from-a-seeded-test-host.md
  - https://github.com/softov/ahpd/tree/main/.project/plans/host/20261104-1619-a-demo-host-shows-every-subject - the ahpd plan for `examples/demo`, which this script starts
  - "[code://src/tui.tsx#L273-L345](../../../../src/tui.tsx#L273-L345) - `still`, which draws one frame of a screen to SVG"
  - "[code://docs/use/SCREEN.md#L20-L53](../../../../docs/use/SCREEN.md#L20-L53) - the three stills the site shows today, drawn from the scripted host"
  - "[code://docs/img/sessions.svg](../../../../docs/img/sessions.svg) - a still that names Softov's work projects, to be drawn again"
  - "[code://docs/subjects/AUTOMATIONS.md#L5-L17](../../../../docs/subjects/AUTOMATIONS.md#L5-L17) - a *Screen* section: one line on how to open the screen, then a table of keys"
  - "[code://.project/plans/documentation/20261103-1238-each-subject-shows-its-screen/task-01-each-subject-page-has-a-picture.md](../20261103-1238-each-subject-shows-its-screen/task-01-each-subject-page-has-a-picture.md) - the picture lines and alt text this plan takes over"
  - "[code://tools/schema.mjs](../../../../tools/schema.mjs) - a script in `tools/` that an `npm run` line starts"
---

## Goal

Each subject page with a *Screen* section shows a picture of its screen.
`npm run docs:pictures` draws every picture from ahpd's demo host, so a picture is drawn again by one command.
No picture names a project, host or person of Softov's.
This plan replaces [documentation/20261103-1238-each-subject-shows-its-screen](../20261103-1238-each-subject-shows-its-screen/plan.md), whose placeholders are no longer needed.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `grep -n "## Screen" docs/subjects/*.md` - 9 pages: AGENTS, AUTOMATIONS, CHANGES, CHATS, CUSTOMIZATIONS, RESOURCES, SESSIONS, TERMINALS and TURNS.
- `grep -rn "img/" docs README.md` - `sessions.svg`, `transcript.svg` and `compose.svg`, in `README.md` and `docs/use/SCREEN.md`.
- A still against ahpd's `notes` host, on 2026-11-04: the session list drew; changes and files drew empty; every screen drew `No provider called claude`. The two plans in `requires` fix both.

### Runtime path

```
npm run docs:pictures -> tools/pictures.mjs -> $AHPD_DIR examples/demo on a free port
  -> a demo folder in git -> ahpc commands seed sessions, chats, automations and a terminal
  -> ahpc --static --svg docs/img/<name>.svg --screen <screen> --host ws://127.0.0.1:<port>
  -> the host stops, the demo folder goes
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| The script lives in ahpc as `npm run docs:pictures` | Softov, 2026-11-04: "In ahpc, as npm run docs:pictures" | 01 |
| It finds the ahpd checkout through `AHPD_DIR`, and refuses without it | Softov, 2026-11-04: "In ahpc, as npm run docs:pictures" | 01 |
| The data is made through ahpc's own commands | Softov, 2026-11-04: "Through ahpc's commands" | 01 |
| The host is ahpd's `examples/demo` | Softov, 2026-11-04: "New examples/demo, reusing notes" | 01 |
| The host and ahpc run with `XDG_CONFIG_HOME`, `XDG_DATA_HOME` and `XDG_STATE_HOME` in a scratch folder | Softov, 2026-11-04: "create a XDG server test" | 01 |
| The 11 pictures, their screens and what the host holds are the brief's table | Softov, 2026-11-04: "Commit it and plan it" | 01 |
| The demo folder is made fresh in a scratch folder on each run, with an edited, a deleted, a new and a staged file, and folders a few levels deep | (defaulted: the brief's change list; a fresh folder draws the same picture each run) | 01 |
| Every name in the demo data is neutral | (defaulted: the brief's change list) | 01 |
| The three existing pictures keep their file names and pixel sizes | (defaulted: `README.md` and `docs/use/SCREEN.md` link them) | 01 |
| A new picture is 820 pixels wide, as the existing three are | (defaulted: the site draws them at one width) | 01 |
| Each subject page shows its picture under `## Screen`, before its text, with alt text that says what the screen shows | (defaulted: 1238's answers, taken over) | 02 |
| TELEMETRY gets no picture | (defaulted: it has no screen) | 02 |
| 1238 is set to `dropped`, and names this plan | (defaulted: this plan draws the real pictures in place of its placeholders) | - |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - npm run docs:pictures draws every picture](task-01-docs-pictures-draws-every-picture.md) | todo | - |
| [02 - Each subject page shows its picture](task-02-each-subject-page-shows-its-picture.md) | todo | 01 |

## Risks and tradeoffs

- Times on the screen come from the clock, so each run draws them a little differently. A picture's diff after a new run is expected.
- The script starts ahpd's example from another checkout. A change to `examples/demo` changes the pictures, and the ahpd plan's test pins what the demo host serves.

## Resume state

- **Done so far:** planned 2026-11-04.
- **Next action:** build the plans in `requires` and ahpd's demo host, then [task-01-docs-pictures-draws-every-picture.md](task-01-docs-pictures-draws-every-picture.md).
- **Open questions:** none.
- **Watch out for:** a still that reaches its 10 second cap draws what it has. Check each picture by eye before a commit.

## Final verification checklist

- [ ] `AHPD_DIR=<ahpd checkout> npm run docs:pictures` writes the 11 pictures and leaves no process and no scratch folder behind.
- [ ] `grep -il "brb\|advisor\|softov" docs/img/*.svg` prints nothing.
- [ ] `npm run docs:build` passes.
- [ ] Each of the 9 subject pages shows its picture under *Screen* in `npm run docs:dev`.
