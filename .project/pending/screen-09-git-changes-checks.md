---
title: Check screen/09 against a host with a GitHub remote
plans:
  - plans/screen/09-git-changes-take-their-arguments/plan.md
---

# Check screen/09 against a host with a GitHub remote

screen/09 is built, and its cases pass against the fake host.
This run checks commit, prepare and create against a real ahpd, and the OSC 8 link in two terminals.
The create step pushes a branch and opens a real pull request, so use a repository where a test pull request is allowed.

## Set up

1. Clone a GitHub repository where you may open a test pull request, as `<work>`.
2. In `<work>`, make a new branch, and edit two files.
3. Check that `gh auth status` shows a login that can push to the repository.
4. Do steps 1 to 5, 8, 9 and 10 of *Set up* in [screen-10-clickable-rows-checks.md](screen-10-clickable-rows-checks.md).
5. Open the session, and press `c` to open the changes.

## screen/09: the staged mark

1. Run `git add` on one of the two files in `<work>`.
2. Check that the row of that file ends with `SM`, and the other row ends with ` M`.

## screen/09: commit

1. Run the commit on the whole changeset.
2. Check that the prompt opens on the session title.
3. Check that the prompt says how many staged files the commit takes.
4. Write a message, and check that `git log -1` in `<work>` shows it.

## screen/09: prepare and create

1. Edit one more file in `<work>`, and check that *Create PR* shows on the actions row.
2. Press `p` or click *Create PR*, and check that the form opens with the host's title and body.
3. Change the title, and check that the form cannot be sent with an empty title.
4. Send the form, and check that the pull request on GitHub has the title and the body from the form.
5. Check that the status row shows the link to the pull request and says "copied".
6. Paste the clipboard, and check that it holds the same link.

## screen/09: the link in a terminal with OSC 8

1. Do *screen/09: prepare and create* in a terminal with OSC 8 support, such as GNOME Terminal or kitty.
2. Click the link on the status row, and check that the pull request opens in the browser.

## screen/09: the link in a terminal without OSC 8

1. Do *screen/09: prepare and create* in a terminal without OSC 8 support, such as xterm.
2. Check that the status row shows the link as plain text, with no stray escape characters.

## screen/09: the shell

1. Run `node <ahpc>/dist/src/main.js --host ws://127.0.0.1:9313 --connection-token-file <scratch>/token changes <session> --run commit --message "<text>"`.
2. Check that `git log -1` in `<work>` shows the message.
3. Run `changes <session> --run create-pr --title "<text>" --body "<text>" --draft` with the same host flags.
4. Check that the command prints the link, and that GitHub has a draft pull request.

## Clean up

1. Close the test pull requests on GitHub, and delete their branches.

## Reply

- Write "ok", or what went wrong at which step.
