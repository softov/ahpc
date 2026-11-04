---
title: npm run docs:pictures draws every picture
status: todo
depends: []
layer: "tools"
refs:
  - "[code://src/tui.tsx#L273-L345](../../../../src/tui.tsx#L273-L345) - the still each picture is"
  - "[code://src/config.ts#L82-L87](../../../../src/config.ts#L82-L87) - ahpc reads `$XDG_CONFIG_HOME` first"
  - "[code://tools/schema.mjs](../../../../tools/schema.mjs) - the shape of a script in `tools/`"
---

## Objective

`npm run docs:pictures` starts ahpd's demo host, makes the demo data, draws the 11 pictures into `docs/img/` and stops the host.

## Files

- `CREATE: tools/pictures.mjs` - the script: the host, the demo folder, the seed and the stills.
- `UPDATE: package.json` - `docs:pictures`, which builds and runs the script.
- `UPDATE: DEVELOPER.md` - how to draw the pictures again, with `AHPD_DIR`.
- `UPDATE: docs/img/sessions.svg` - drawn again from the demo host.
- `UPDATE: docs/img/transcript.svg` - drawn again from the demo host.
- `UPDATE: docs/img/compose.svg` - drawn again from the demo host.
- `CREATE: docs/img/turns.svg` - a turn waiting on a permission.
- `CREATE: docs/img/chats.svg` - a session with two chats.
- `CREATE: docs/img/agents.svg` - the agent and model pickers.
- `CREATE: docs/img/changes.svg` - the demo folder's changes, with a staged file.
- `CREATE: docs/img/resources.svg` - the demo folder.
- `CREATE: docs/img/terminals.svg` - a shell with output.
- `CREATE: docs/img/automations.svg` - two automations, one with a run.
- `CREATE: docs/img/customizations.svg` - the demo agent's customizations.

## Steps

1. Refuse to start without `AHPD_DIR`, with one sentence that names it.
2. Make a scratch folder, and point the three `XDG_` variables into it for every process the script starts.
3. Make the demo folder in git there, with neutral names, folders a few levels deep, and one commit.
4. Edit a file, delete a file, add a file, and stage one more change.
5. Start `examples/demo` from `AHPD_DIR` on a free port, and wait until it answers.
6. Make sessions in two folders: one idle with a finished turn, one running `slow`, one in error from `fail`.
7. Make one session waiting on a question and one waiting on a permission, with the `notes` prompts.
8. Add a second chat to one session with `chat new`.
9. Make a schedule automation and an automation on a finished session with `automation new`, and run one.
10. Open a terminal with `terminal new`, and send it a command that prints a few lines.
11. Draw each picture with `ahpc --static --svg`, at the screen and session the brief's table names.
12. Keep the pixel size of the three existing pictures, and draw the new ones 820 pixels wide.
13. Stop the host and remove the scratch folder on success, on error and on Ctrl+C.

## Validation

- Run `AHPD_DIR=<ahpd checkout> npm run docs:pictures`, and check that it writes the 11 pictures.
- Open each picture, and check that it shows what the brief's table names, with no error line.
- Run `grep -il "brb\|advisor\|softov" docs/img/*.svg`, and check that it prints nothing.
- Check that no ahpd process and no scratch folder remains after the run.
- Run the script without `AHPD_DIR`, and check that it stops with the sentence.

## Resume
