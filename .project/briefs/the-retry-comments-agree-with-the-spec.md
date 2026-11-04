---
title: The comments on a refused act agree with the spec, and a retry is tested
created: 2026-11-04
replaces:
  - problems/two-comments-disagree-about-what-is-retried.md
refs:
  - git://3bcf162 - the commit of this repository the facts were checked at, and the last commit that holds the problem
  - "[code://src/cli/main.ts#L947-L955](../../src/cli/main.ts#L947-L955) - the shell says nothing is retried \"because the act may already have done something\""
  - "[code://src/control.ts#L717](../../src/control.ts#L717) - `guard`, which runs a refused act once more after a token is accepted"
  - "[code://src/control.ts#L876-L884](../../src/control.ts#L876-L884) - `createChat` and `disposeChat` through `guard`"
  - "[code://src/control.ts#L1147-L1166](../../src/control.ts#L1147-L1166) - `disposeSession` and `createSession` through `guard`"
  - "[decisions/one-accepted-credential-runs-the-act-again.md](../decisions/one-accepted-credential-runs-the-act-again.md) - the decision that fixes the count at one"
  - file:///github/agent-host-protocol/docs/specification/authentication.md - at `2c37a04f`, a client that gets `AuthRequired` SHOULD push a token and retry the original command, with `createSession` as the example
---

# The comments on a refused act agree with the spec, and a retry is tested

The screen's retry of a refused act is right, and the shell's comment gives the real reason it does not retry.
The AHP spec says a client that gets `-32007` SHOULD push a token and "Retry the original command", and its example is `createSession`.
The spec calls a `-32007` a command that "fails", and tells the client to run it again.

## What others do

- The AHP spec's *AuthRequired Error Code* section lists four steps for a client.
- The steps are: read the resources, get tokens, push them with `authenticate`, and retry the original command.

## What ahpc has today

- The screen runs a refused `createSession`, `createChat`, `disposeChat` or `disposeSession` once more after a token is accepted, through `guard` ([`code://src/control.ts#L717`](../../src/control.ts#L717)).
- The shell's comment says nothing is retried "because the act may already have done something before it was refused" ([`code://src/cli/main.ts#L947-L955`](../../src/cli/main.ts#L947-L955)).
- The decision `one-accepted-credential-runs-the-act-again` fixes the count at one, and does not say which acts may run again.
- No test runs a refused `createSession` again.

## Who writes

- `/github/ahpc` is on `main` at `3bcf162`, and no pull request is open.
- [a-refused-command-names-the-variable.md](a-refused-command-names-the-variable.md) changes the sentence near the shell's comment, not the comment.

## The change

- The shell's comment says it does not retry because it has nobody to ask for a token.
- The comment also says that an exported variable is pushed on every connection already.
- The decision `one-accepted-credential-runs-the-act-again` says that every awaited act may run once more, as the spec's example does.
- A test refuses `createSession` once, accepts a token, and checks that the session is made once.
