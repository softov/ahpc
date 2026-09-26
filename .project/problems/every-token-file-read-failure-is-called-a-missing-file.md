---
title: Every failure to read a connection token file is reported as a missing file
status: open
date: 2026-09-26
severity: minor
refs:
  - "[code://src/config.ts#L159-L170](../../src/config.ts#L159-L170) - `readTokenFile`, whose `catch` takes no notice of why the read failed"
  - "[review/2026-09-26-before-launch.md](../review/2026-09-26-before-launch.md) - finding 6"
  - git://136fd3f - the change that introduced it
---

## Symptom

`readTokenFile` catches every `readFileSync` failure and says `No connection token at <path>. The host writes one there when it is given --connection-token-file.`
A file that exists but cannot be read (`EACCES`), a path that is a directory (`EISDIR`), and a symlink loop all get the sentence for a file that is not there, which tells the person to look for the wrong thing.

`~/.config/ahpc/host.token` in the config file is not expanded and is read as a relative path with a literal `~` in it.
A relative path resolves against the working directory, so the same config file behaves differently depending on where `ahpc` was started.

## Cause

`src/config.ts:159-170`: one bare `catch` for every reason a read can fail, and no expansion or resolution of the path before it is opened.

## Impact

A permissions mistake reads as a missing file, which is the one cause the sentence names and the one it is not.
A `~` path in a config file silently never works, and a relative one works from some directories and not others.

## Workaround

Use an absolute path with no `~`, and check permissions by hand when the file is plainly there.

## Fix

Report the reason the read failed, keeping the host's-flag sentence for `ENOENT` alone.
Expand a leading `~` and resolve a relative path against the config file's own directory rather than the working directory.
