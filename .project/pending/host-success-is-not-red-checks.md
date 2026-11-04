---
title: Check that the host's answer to a changeset verb is not red
plans:
  - plans/screen/20261103-1619-a-host-success-is-not-red/plan.md
---

# Check that the host's answer to a changeset verb is not red

The plan is on `main`.
These checks close it.

## Set up

1. Do steps 1 to 11 of *Set up* in [hand-check-findings.md](hand-check-findings.md).
2. Run `<ahpc>` with no command, and open `<session>` from the list.
3. Press escape until focus is on the history, and press `c` to open the changes screen.

## A commit is green

1. Press `c`, choose *All files*, type a message, and press enter.
2. Check that the status row says `Committed <sha>: <message>` in green.

## Reply

- Write "validated", or what you saw that differs.
