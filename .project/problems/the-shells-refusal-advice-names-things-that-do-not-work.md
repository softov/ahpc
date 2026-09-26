---
title: The shell's refusal advice names two things that do not work
status: open
date: 2026-09-26
severity: minor
refs:
  - "[code://src/cli/main.ts#L468-L471](../../src/cli/main.ts#L468-L471) - `needsToken`, the sentence a refused command prints"
  - "[code://src/connect.ts#L576-L581](../../src/connect.ts#L576-L581) - `signInSentence`, which has the same problem"
  - "[review/2026-09-26-before-launch.md](../review/2026-09-26-before-launch.md) - finding 1"
---

## Symptom

A `-32007` from any command prints `Pass --token, set AHPC_TOKEN_<RESOURCE>, or pipe one in: ahpc auth <RESOURCE>`.
Two thirds of that is wrong outside `ahpc auth`.
On `session list`, `--token` is the *connection* token and has nothing to do with the resource being refused, and `ahpc auth <RESOURCE>` authenticates a connection that closes when that command exits, so it cannot help the command that was refused.

The middle third became true with plan ahp/02, which pushes an exported `AHPC_TOKEN_<RESOURCE>` on every connection.

## Cause

`src/cli/main.ts:468-471`: one sentence shared by `signIn`, where all three sources are real, and by the refusal catch, where only one is.
`src/connect.ts:576-581` repeats it.

## Impact

A person follows the advice, passes `--token`, and replaces the connection token instead of authenticating the resource, which fails differently and for a reason the sentence does not mention.

## Workaround

Export `AHPC_TOKEN_<RESOURCE>` and run the command again.

## Fix

Two sentences rather than one: what `ahpc auth` can offer, and what a refused command can. Only the environment variable belongs in the second.
