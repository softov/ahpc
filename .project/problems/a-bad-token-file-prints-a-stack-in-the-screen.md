---
title: A bad connection token file prints a stack in the screen, and a configured one breaks the scripted host
status: open
date: 2026-09-26
severity: major
refs:
  - "[code://src/tui.tsx#L348-L354](../../src/tui.tsx#L348-L354) - where the screen resolves the token, with nothing around it"
  - "[code://src/main.tsx#L46-L69](../../src/main.tsx#L46-L69) - the `Fault` catch, which wraps the shell and not the screen"
  - "[code://src/config.ts#L136-L170](../../src/config.ts#L136-L170) - `connectionToken` and `readTokenFile`, which throw"
  - "[review/2026-09-26-before-launch.md](../review/2026-09-26-before-launch.md) - finding 5"
  - git://136fd3f - the change that introduced it
---

## Symptom

`ahpc --connection-token-file /absent` in the screen prints a stack trace.
The shell prints one sentence for the same mistake, because `src/main.tsx` turns a `Fault` into a line only on the path that loads the CLI.

Worse, the screen resolves the token before it knows whether there is a host to send one to.
A `connectionTokenFile` in the config file pointing at a file that is not there stops a bare `ahpc`, which talks to the scripted host and needs no token at all.

## Cause

`src/tui.tsx:348` calls `connectionToken` with no `try` around it, and the screen has no error surface of its own: `src/main.tsx` catches `Fault` for `cli()` and lets `tui()` reject.
The call is unconditional, so it runs even when `options.host` is undefined and the scripted host is what will answer.

## Impact

A typo in a path is indistinguishable from this client crashing.
A configured token file that goes missing takes away the scripted host as well as the live one, which is the mode that is supposed to need nothing installed.

## Workaround

Pass `--connection-token-file` only with `--host`, and remove `connectionTokenFile` from the config file when running against the scripted host.

## Fix

Give the screen the same one-sentence surface the shell has, and resolve the connection token only when there is a host to present it to.
