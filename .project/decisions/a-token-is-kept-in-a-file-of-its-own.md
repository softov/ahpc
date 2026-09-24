---
title: A token is kept in a file of its own, and looked for before anybody is asked
status: accepted
date: 2026-09-24
supersedes: decisions/the-prompt-does-not-keep-the-secret.md
refs:
  - "[code://src/config.ts#L72-L80](../../src/config.ts#L72-L80) - `statePath`, the helper for a file a program rewrites on its own schedule"
  - "[code://src/cli/main.ts#L1302-L1305](../../src/cli/main.ts#L1302-L1305) - the chain the shell already resolves: `--token`, then the resource's variable, then a pipe"
  - "[code://src/cli/main.ts#L1324-L1327](../../src/cli/main.ts#L1324-L1327) - `tokenVariable`, which derives `AHPC_TOKEN_<RESOURCE>` from the resource"
  - "[code://src/control.ts#L498-L512](../../src/control.ts#L498-L512) - `askSignIn`, which opens the modal without consulting anything"
  - file:///home/softov/projects/ahpx/src/auth/handler.ts#L77-L93 - `resolveToken`, the chain ahpx resolves before it ever prompts
  - file:///home/softov/projects/ahpx/src/auth/handler.ts#L188-L217 - `storeToken`, written at 0600 through a temporary file and a rename
  - file:///github/ahpapp/src/storage.ts#L120-L130 - the reference's Keychain, with ordinary storage as the fallback
---

## Context

The prompt this client grew asks the person for a token every time a host refuses, and looks nowhere first.
The shell half of the same client already resolves `--token`, then `AHPC_TOKEN_<RESOURCE>`, then a pipe, and its own refusal sentence tells a person to set that variable.
So `ahpc auth` honours the variable and the screen ignores it, and a person who did what the sentence told them is asked anyway.

The two sibling clients both keep the credential.
ahpapp puts it in the Keychain with ordinary storage as a fallback, and ahpx writes `~/.ahpx/auth.json` at 0600 through a temporary file and a rename.
ahpc keeps nothing, which was decided when the prompt was built and before the comparison was made.
The cost of that decision is not one retype after a reconnect, which is how it was written down: it is a retype on every run of the program, for every protected resource, because nothing carries across a process.

## Decision

A token lives in a file of this client's own, beside the configuration rather than inside it, written at 0600 through a temporary file and a rename.
Before the prompt is opened for a resource, a token is looked for in `AHPC_TOKEN_<RESOURCE>` and then in that file, and a token found there is pushed without asking anybody.
A credential the person types and the host accepts is written to the file; one the host refuses is not.
The prompt still holds what was typed only until it is submitted, and the store still never holds a secret.

Source: Softov, 2026-09-24, asked "Where should the TUI prompt look before asking the person to type a token?" and answered "Env var, then a stored file".

## Consequences

A person types a token once rather than once per run, which is the thing both sibling clients already provide and the thing this client alone did not.
There is now a copy of the secret that outlives the process, so the file is this client's to protect: 0600, its own file, never `config.json`, and never the store.
A stale token becomes possible, which the connection did not have to think about before, so a credential the host refuses has to be dropped from the file rather than left to be retried forever.
`the-prompt-does-not-keep-the-secret` is superseded; its reasoning about the store and about `config.json` is kept and is why the file is neither.

## Options

- **Keep nothing, as before.** Rejected: it is the only client of the three that asks every run, and the refusal sentence already promises a variable the screen does not read.
- **Read the environment variable but write nothing.** Rejected: it fixes the disagreement between the two halves of this client and still asks every run on a machine where nobody exported anything, which is most of them.
- **Write it into `config.json`.** Rejected for the reason the superseded decision gave: that file is hand-written, shared, backed up and pasted into issues.
- **A system keyring.** Rejected for now: it is a dependency and a platform matrix, and `statePath` with 0600 is what this client already has. It stays open as the better answer if a token file proves to be the wrong place.
