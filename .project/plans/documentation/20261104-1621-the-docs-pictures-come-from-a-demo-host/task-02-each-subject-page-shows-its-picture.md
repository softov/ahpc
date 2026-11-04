---
title: Each subject page shows its picture
status: done
depends: [task-01-docs-pictures-draws-every-picture.md]
layer: "docs"
refs:
  - "[code://docs/use/SCREEN.md#L20](../../../../docs/use/SCREEN.md#L20) - the picture line to copy"
---

## Objective

The 9 subject pages with a *Screen* section show their picture under the heading.

## Files

- `UPDATE: docs/subjects/AGENTS.md:5` - `../img/agents.svg` under `## Screen`.
- `UPDATE: docs/subjects/AUTOMATIONS.md:5` - `../img/automations.svg` under `## Screen`.
- `UPDATE: docs/subjects/CHANGES.md:5` - `../img/changes.svg` under `## Screen`.
- `UPDATE: docs/subjects/CHATS.md:5` - `../img/chats.svg` under `## Screen`.
- `UPDATE: docs/subjects/CUSTOMIZATIONS.md:5` - `../img/customizations.svg` under `## Screen`.
- `UPDATE: docs/subjects/RESOURCES.md:5` - `../img/resources.svg` under `## Screen`.
- `UPDATE: docs/subjects/SESSIONS.md:5` - `../img/sessions.svg` under `## Screen`.
- `UPDATE: docs/subjects/TERMINALS.md:5` - `../img/terminals.svg` under `## Screen`.
- `UPDATE: docs/subjects/TURNS.md:5` - `../img/turns.svg` under `## Screen`.

## Steps

1. Under `## Screen` in each page, add one blank line, the picture line, and one blank line.
2. Write the alt text as what the screen shows, as `docs/use/SCREEN.md` does.
3. In `SESSIONS.md`, use the alt text of `docs/use/SCREEN.md#L20`.

## Validation

- Run `npm run docs:build`, and check that it passes.
- Run `npm run docs:dev`, open each of the 9 subject pages, and check the picture under *Screen*.

## Resume
