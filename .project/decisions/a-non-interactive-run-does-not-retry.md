---
title: A non-interactive run says what to do and exits, and never retries
status: accepted
date: 2026-09-23
refs:
  - code://src/main.tsx#L40-L66 - the entry point, where a `Fault` is a sentence and anything else is a stack
  - code://src/cli/main.ts#L360-L372 - `cli`, which builds one host and switches over the command
  - code://src/cli/main.ts#L1255-L1288 - `signIn`, the credential sources this leaves alone
  - code://src/cli/main.ts#L1297-L1300 - `tokenVariable`, the environment variable a resource's token is read from
  - code://src/cli/main.ts#L225-L239 - `where`, where `--token` is the connection token and not a resource's
  - code://src/connect.ts#L73-L86 - the sentence the connection already prints
---

## Context

A command run with no screen has nobody to ask.
Today a `-32007` from a command rejects and is not a `Fault`, so `main.tsx` prints a stack trace over a host that is working perfectly and simply wants a credential.
The credential sources for a resource already exist and are not the screen's: `ahpc auth <resource>` reads `--token`, then the environment variable `tokenVariable` derives from the resource, then standard input.

## Decision

A non-interactive run never prompts and never retries an act.
A `-32007` becomes a sentence that names the resource and the environment variable that would satisfy it, and the exit code is 1.
`ahpc auth <resource>` remains the way to push a credential, and the connection's own printed sentence remains the first thing a person sees.

## Consequences

A script that is refused fails with a sentence rather than a stack trace, which is the difference between a client that is broken and a host that wants a credential.
The credential order `ahpc auth` already has is untouched, so the sentence names the variable that makes that command answer without a flag.
The retry lives only where a person is: a command that had already done something before the refused act is not repeated behind their back.

## Options

- **Authenticate from `AHPC_TOKEN_<RESOURCE>` and retry the command.** Rejected: the retry would have to sit on each act rather than on the command, and a command that had already sent something before the refusal would send it again.
- **Prompt on the terminal when stdin is a TTY.** Rejected: a TTY is not a person answering, a piped command can still have one, and a secret typed at a shell prompt is echoed or needs a second hidden-input implementation the screen already has.
- **Leave the stack trace and only improve the sentence.** Rejected: the sentence is already printed, and the stack is what a person actually reads and reports as a bug.
