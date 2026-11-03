---
title: Check screen/10 in a real terminal
plans:
  - plans/screen/10-the-changes-rows-are-clickable/plan.md
---

# Check screen/10 in a real terminal

Softov ran these checks on 2026-11-03, and they passed.
The file stays for its *Set up*, which other checks use.

screen/10 is built, and its cases pass in `test/changes.test.tsx` at 60 and 100 columns.
This run checks the clicks and the keys in a real terminal, against an ahpd built from `main`.

## Set up

1. In the ahpd checkout, on `main`, run `pnpm install` and `pnpm build`.
2. In the ahpc checkout, on `main`, run `npm install` and `npm run build`.
3. Make an empty folder `<scratch>` with a folder `xdg` in it.
4. Write a token with `openssl rand -hex 16 > <scratch>/token`.
5. Write `<scratch>/config.json` as `{"plugins":[{"name":"<ahpd>/packages/agent-claude"}]}`, where `<ahpd>` is the ahpd checkout.
6. Make a folder `<work>` with `git init`, two committed files and one commit.
7. In `<work>`, edit one committed file, delete the other, and add one new file.
8. Start the host with `XDG_CONFIG_HOME=<scratch>/xdg node <ahpd>/packages/server/dist/main.js --port 9313 --config-file <scratch>/config.json --sessions memory --automations memory --no-update-check --connection-token-file <scratch>/token --path <work> --no-cwd`.
9. Start a session with `node <ahpc>/dist/src/main.js --host ws://127.0.0.1:9313 --connection-token-file <scratch>/token session new --cwd <work>`.
10. Open the screen with the same command and no `session new`.

## screen/10: a click at 100 columns

1. Set the terminal to 100 columns.
2. Open the session from step 9, and press `c` to open the changes.
3. Click a scope tab that is not disabled, and check that the list shows that scope's files.
4. Open a file, click another scope tab, and check that the file closes.
5. Click a disabled tab, and check that the scope does not change.
6. Click an action button, and check that the action runs or asks what it needs.
7. Check that each action button shows its key, such as `Commit c`, and that the status row lists no verb key.

## screen/10: the keys at 100 columns

1. Press Tab until a scope tab has the focus.
2. Press `right` and `left`, and check that each press picks the next or the previous scope.
3. Press Tab until an action button has the focus.
4. Press Enter, and check that the action runs or asks what it needs.
5. With a tab or a button focused, press `]`, `r` and `x`, and check that each works as before.

## screen/10: both checks at 60 columns

1. Set the terminal to 60 columns.
2. Do the steps of *screen/10: a click at 100 columns* again.
3. Do the steps of *screen/10: the keys at 100 columns* again.
4. Check that the tabs and the buttons fit, and that no label is cut in the middle.
5. Check the status row for an empty hint where `] changeset` belongs.

## Known limits

- An arrow stops at a disabled tab, so a scope past one is reached by a click or `]`.

## Reply

- Write "ok", or what went wrong at which step.
