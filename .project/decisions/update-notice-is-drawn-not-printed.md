---
title: The update notice is a line the screen draws in its status area, never one written to stdout
status: accepted
date: 2026-09-18
refs:
  - git://aa7b91e - ROADMAP.md "Telling somebody the version is old" as written on 2026-09-06; the prose left the roadmap for this plan
  - code://src/app.tsx#L394-L415 - `ChatStatus`, the status surface, which already gives its row to the host's last refusal
  - code://src/state.ts#L166 - `HOST_ERROR`, the store key that refusal lives under; the notice gets a sibling
---

## Context

Anything written to stdout before the alternate screen opens is erased by it.
Anything written after corrupts the frame.
The status surface is the one row that is on every screen and already carries a sentence when the host refuses something.

## Decision

The notice is a value in the store, `UPDATE_NOTICE`, that `ChatStatus` draws in place of the key hints when there is no refusal to show.
A refusal wins, because it is about the key the person just pressed; the hints lose, because they are still a chord away in the palette.
The verbs that print and leave, `ahpc status` among them, may print the same sentence on stdout, because they own stdout and there is no frame to corrupt.

The row is set from the file when the screen opens and again after each refresh, so a release that lands while the screen is up reaches the row.

Source: Softov, ROADMAP.md, 2026-09-06; the precedence over hints and the live row, Softov, 2026-09-18.

## Consequences

The notice stays for the life of the screen once set, since nothing clears `UPDATE_NOTICE`; a refresh can only add one, never take one away.
`--static` renders one frame and leaves, so it draws the notice if the file already says so and never fetches.

## Options

A modal or a toast on open takes a keypress from a person who came to read a session.
A line in the transcript would be a message from nobody, in a list of messages from the agent.
