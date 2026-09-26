---
title: Only a read somebody asked for opens the sign-in prompt
status: accepted
date: 2026-09-26
refs:
  - "[code://src/control.ts#L598-L604](../../src/control.ts#L598-L604) - `reread`, the catalogue read every status tick runs"
  - "[code://src/control.ts#L666-L671](../../src/control.ts#L666-L671) - `refresh(ask)`, where the guard is now opt-in"
  - "[code://src/control.ts#L2380](../../src/control.ts#L2380) - `session.refresh`, bound to `r` and `ctrl+r`"
---

## Context

A host that protects `listSessions` refuses the catalogue read, and `guard` turns that refusal into the sign-in prompt.
The read ran through `guard` on every status event as well as on `r`, so a person who dismissed the prompt had it back on the next tick, with the keyboard taken from the composer.

## Options

- **Background reads call the host directly, and only a read a person asked for goes through `guard`.** A refusal on a tick is said on the status bar; `r`, `ctrl+r`, the palette, a link and the first read at start-up still ask.
- **Remember a dismissal per resource and skip the prompt for it until something resets it.** Keeps every read guarded, and adds state whose reset is its own question: a new refusal, a reconnect, a timer.

## Decision

Background reads do not ask. `refresh(true)` is the only catalogue read that can open the prompt, and it is called where a person did something: start-up, `session.refresh`, and opening a link.

Source: Softov, 2026-09-26: "ok do then.", in answer to the review's "Background reads should call the host without `guard`; only `r` should ask."

## Consequences

The reads that follow an act of their own, such as archiving or creating a session, stay silent: the act was guarded, and asking a second time for the read after it would be the same prompt twice.
A host that starts refusing mid-session shows it on the status bar, and the person presses `r` to sign in.
