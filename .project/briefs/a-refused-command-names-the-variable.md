---
title: A command a host refuses names the variable that would let it through
created: 2026-11-04
replaces:
  - problems/the-shells-refusal-advice-names-things-that-do-not-work.md
refs:
  - git://3bcf162 - the commit of this repository the facts were checked at, and the last commit that holds the problem
  - "[code://src/cli/main.ts#L981](../../src/cli/main.ts#L981) - a `-32007` from any command prints `needsToken`"
  - "[code://src/cli/main.ts#L999-L1002](../../src/cli/main.ts#L999-L1002) - `needsToken`, one sentence with three ways in"
  - "[code://src/cli/main.ts#L1584-L1589](../../src/cli/main.ts#L1584-L1589) - `ahpc auth`, where the three ways are real"
  - "[code://src/connect.ts#L71-L89](../../src/connect.ts#L71-L89) - `signInSentence`, which points a command run with no screen at `ahpc auth`"
---

# A command a host refuses names the variable that would let it through

A command that a host refuses with `-32007` says `Set AHPC_TOKEN_<RESOURCE> and run it again.`
`ahpc auth` keeps its own sentence, with its three ways in.
Softov, 2026-11-04: "Only the variable".

## What others do

- Since plan ahp/02, ahpc pushes an exported `AHPC_TOKEN_<RESOURCE>` on every connection, so the variable is the one way in that works for any command.

## What ahpc has today

- A `-32007` from any command prints `<resource> needs a token. Pass --token, set AHPC_TOKEN_<RESOURCE>, or pipe one in: ahpc auth <resource>` ([`code://src/cli/main.ts#L999-L1002`](../../src/cli/main.ts#L999-L1002)).
- Outside `ahpc auth`, `--token` is the connection token, so passing it replaces the wrong secret.
- `ahpc auth` signs in a connection that closes when it exits, so it cannot help the command that was refused.
- `signInSentence` points at `ahpc auth` too ([`code://src/connect.ts#L71-L89`](../../src/connect.ts#L71-L89)).

## Who writes

- `/github/ahpc` is on `main` at `3bcf162`, and no pull request is open.
- [the-resource-token-has-its-own-flag.md](the-resource-token-has-its-own-flag.md) changes the `ahpc auth` sentence to name `--resource-token`. The two briefs change the same function, so they are planned together or one after the other.

## The change

- A refused command says `<resource> needs a token. Set AHPC_TOKEN_<RESOURCE> and run it again.`
- `signInSentence` names the variable in place of `ahpc auth`, and an expired token says "has expired" in place of "needs a token".
- `ahpc auth` with no token keeps a sentence of its own with its three ways in.
- A test checks each sentence.
