---
title: Check that the changes list follows the host while the screen is open
plans:
  - plans/screen/20261103-1443-the-changes-list-follows-the-host/plan.md
---

# Check that the changes list follows the host while the screen is open

The plan is on `main`.
These checks close it.

## Set up

1. Do steps 1 to 11 of *Set up* in [set-up-a-test-host.md](set-up-a-test-host.md).
2. Run `<ahpc>` with no command, and open `<session>` from the list.
3. Press escape until focus is on the history, and press `c` to open the changes screen.
4. Check that the list shows the edited, the deleted and the new file.

## A tick shows

1. Select a file, and press `r`.
2. Check that the tick shows on the row, with no other key pressed.

## A commit empties the list

1. Press `c`, choose *All files*, type a message, and press enter.
2. Check that the list empties without `]`.

## Reply

- Write "validated", or what you saw that differs.
