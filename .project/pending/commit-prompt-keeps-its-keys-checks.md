---
title: Check that the commit prompt keeps its keys while the changeset changes
plans:
  - plans/screen/20261103-1529-the-commit-prompt-keeps-its-keys/plan.md
---

# Check that the commit prompt keeps its keys while the changeset changes

The plan is on `main`.
These checks close it.

## Set up

1. Do steps 1 to 11 of *Set up* in [hand-check-findings.md](hand-check-findings.md).
2. Run `<ahpc>` with no command, and open `<session>` from the list.
3. Press escape until focus is on the history, and press `c` to open the changes screen.

## Type a message

1. Press `c`, and choose *All files*.
2. Click the text box.
3. Type `stage su`, then press backspace twice.
4. Check that the box shows `stage `, and that no file was staged or unstaged.
5. Type `done`, and press enter.
6. Run `git -C <work> log -1 --format=%s`.
7. Check that the message is `stage done`.

## Reply

- Write "validated", or what you saw that differs.
