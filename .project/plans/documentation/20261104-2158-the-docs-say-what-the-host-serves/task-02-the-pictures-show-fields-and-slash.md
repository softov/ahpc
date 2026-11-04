---
title: The pictures show the fields and the slash menu
status: done
depends: [task-01-a-still-types-into-the-composer.md]
layer: "tools"
refs:
  - "[code://tools/pictures.mjs](../../../../tools/pictures.mjs) - the picture script"
---

## Objective

`compose.svg` shows a new session on the `notes-app` repository, with its fields, and `slash.svg` shows the `/` menu open in a session.

## Files

- `UPDATE: tools/pictures.mjs` - `compose.svg` with `--path`, and `slash.svg` with `--type /`.
- `CREATE: docs/img/slash.svg` - the `/` menu in a session.
- `UPDATE: docs/img/compose.svg` - the new session with its fields.

## Steps

1. Draw `compose.svg` with `--path` on the `notes-app` repository and `--trust`, at 26 rows.
2. Draw `slash.svg` on the `read ideas` session with `--type /`, fitted.
3. Run `AHPD_DIR=<ahpd checkout> npm run docs:pictures` against the ahpd plan's branch.
4. Render each picture, and open it.

## Validation

- `compose.svg` shows `Agent Demo`, the mode, `Ask before`, the folder, the isolation and the branch.
- `slash.svg` shows `summarize` and `tidy` beside ahpc's own commands.
- `grep -il "brb\|advisor\|softov" docs/img/*.svg` prints nothing.

## Resume
