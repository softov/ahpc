---
title: Each subject page has a picture of its screen
status: todo
depends: []
layer: docs
refs:
  - "[code://docs/use/SCREEN.md#L20](../../../../docs/use/SCREEN.md#L20) - the picture line to copy"
  - "[code://docs/img/sessions.svg](../../../../docs/img/sessions.svg) - the size and background a placeholder copies"
---

## Objective

The 9 subject pages with a *Screen* section show a picture under the heading.
SESSIONS shows the still of the session list, and the other 8 show a placeholder that names their screen.

## Files

- `CREATE: docs/img/agents.svg` - the placeholder for the agent and model pickers.
- `CREATE: docs/img/automations.svg` - the placeholder for the automation list.
- `CREATE: docs/img/changes.svg` - the placeholder for the changes screen.
- `CREATE: docs/img/chats.svg` - the placeholder for the chats of a session.
- `CREATE: docs/img/customizations.svg` - the placeholder for the customizations of a session.
- `CREATE: docs/img/resources.svg` - the placeholder for the files screen.
- `CREATE: docs/img/terminals.svg` - the placeholder for the terminal screen.
- `CREATE: docs/img/turns.svg` - the placeholder for a running turn.
- `UPDATE: docs/subjects/AGENTS.md:5` - the picture line under `## Screen`.
- `UPDATE: docs/subjects/AUTOMATIONS.md:5` - the picture line under `## Screen`.
- `UPDATE: docs/subjects/CHANGES.md:5` - the picture line under `## Screen`.
- `UPDATE: docs/subjects/CHATS.md:5` - the picture line under `## Screen`.
- `UPDATE: docs/subjects/CUSTOMIZATIONS.md:5` - the picture line under `## Screen`.
- `UPDATE: docs/subjects/RESOURCES.md:5` - the picture line under `## Screen`.
- `UPDATE: docs/subjects/SESSIONS.md:5` - the picture line under `## Screen`, to `../img/sessions.svg`.
- `UPDATE: docs/subjects/TERMINALS.md:5` - the picture line under `## Screen`.
- `UPDATE: docs/subjects/TURNS.md:5` - the picture line under `## Screen`.

## Steps

1. Write each placeholder as an SVG of 820 by 530 with `rx="6"` and the fill `#0d1117`, as `sessions.svg` has.
2. In each placeholder, put a `<title>` and one centred line, such as "Picture of the automation list", in `#a7a7a7`.
3. Use the font family of `sessions.svg` for the line.
4. Under `## Screen` in each page, add one blank line, the picture line, and one blank line.
5. Write the alt text as what the screen shows, as `docs/use/SCREEN.md` does.
6. In `SESSIONS.md`, use the alt text of `docs/use/SCREEN.md#L20` and the path `../img/sessions.svg`.

## Validation

- Run `npm run docs:build`, and check that it passes.
- Run `npm run docs:dev`, open each of the 9 subject pages, and check the picture under *Screen*.
- Check that `git diff --stat docs/img/sessions.svg docs/img/transcript.svg docs/img/compose.svg` prints nothing.

## Resume
