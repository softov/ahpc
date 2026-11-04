---
title: The pictures show more and fit
status: done
depends: [task-01-a-still-runs-a-command.md]
layer: "tools"
refs:
  - "[code://tools/pictures.mjs](../../../../tools/pictures.mjs) - the script this changes"
---

## Objective

The picture script makes more data, draws each picture at a height that fits it, and draws the palette and the agent picker open.

## Files

- `UPDATE: tools/pictures.mjs` - more automations and files, the fitted height, and the two pictures with `--command`.
- `CREATE: docs/img/keys.svg` - the session list with the palette open.
- `UPDATE: docs/img/agents.svg` - the new session screen with the agent picker open.
- `UPDATE: docs/img/automations.svg` - drawn again, with the other pictures in `docs/img/`.

## Steps

1. Make 5 automations: weekdays, daily, weekly and hourly schedules, and one on an event.
2. Switch one of them off, and run one so it has a run.
3. Add 3 or 4 more changed files to the demo folder, some folders deeper.
4. Draw each picture at 30 rows, and count the empty rows above its hint row.
5. Draw it again that many rows shorter, never under 12 rows.
6. Keep `sessions.svg`, `transcript.svg` and `compose.svg` at their pixel sizes, because `README.md` shows them.
7. Draw `keys.svg` on the session list with `--command app.palette`.
8. Draw `agents.svg` on the new session screen with `--command harness.choose`.

## Validation

- Run `AHPD_DIR=<ahpd checkout> npm run docs:pictures`, and check that it writes every picture.
- Open each picture, and check that no picture has more than 2 empty rows above its hint row.
- Check that `automations.svg` lists 5 automations, one switched off.
- Check that `terminals.svg` shows a prompt and the typed command.

## Resume
