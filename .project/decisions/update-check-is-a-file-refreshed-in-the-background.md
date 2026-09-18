---
title: The answer is read from a file, and only the screen refreshes it
status: accepted
date: 2026-09-18
refs:
  - git://aa7b91e - ROADMAP.md "Telling somebody the version is old" as written on 2026-09-06; the prose left the roadmap for this plan
  - code://src/config.ts#L62-L63 - `configPath(tool)`, which wants a sibling for files the tool writes
  - code://src/main.tsx#L26-L32 - `--version`, answered before either front end loads, and never to fetch
  - code://src/cli/main.ts#L386-L392 - `ahpc status`, a verb that prints and leaves
---

## Context

A start that waits on a registry is a start that hangs on a network nobody can see.
`fetch` holds the event loop open, so a verb that prints and exits would sit there after it had printed if it made one.
The screen is long-lived anyway, so it can afford a request in flight.

## Decision

The screen writes `update.json` under `~/.config/ahpc/`, beside `config.json` and never inside it, holding the package name, the `latest` it read and when it read it.
It refreshes the file when it opens if the file is missing or older than six hours, and every six hours after that, on a timer that does not hold the process open.
The screen's notice and `ahpc status` read the file and say what it says, and neither touches the network; the screen reads it again after each refresh it makes.
`--version`, `--static` and every other verb that prints and leaves never fetch.
A notice that arrives one run late is still a notice.

Source: Softov, ROADMAP.md, 2026-09-06.

## Consequences

The first run of a fresh install says nothing, because there is no file yet.
`config.ts` gains `statePath(tool, file)` beside `configPath(tool)`: a person edits one, the tool writes the other.
The timer must be `unref()`ed, or quitting the screen waits on it.

## Options

Fetching at start, before the screen opens, is what most CLIs do and is the hang described above.
Fetching from `ahpc status` makes a command that answers "is the host there" into a network call to somewhere else.
