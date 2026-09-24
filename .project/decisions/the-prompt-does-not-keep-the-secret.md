---
title: The prompt does not keep the secret it was given
status: accepted
date: 2026-09-23
refs:
  - code://src/ahp/live.ts#L1956-L1980 - `authenticate`, which hands the token to the host for this connection
  - code://src/state.ts#L165-L194 - `HOST_ERROR` and `INPUT_STATUS`, the only free-text the store holds today
  - code://src/cli/main.ts#L1255-L1262 - the comment on `signIn` about credentials and shell history
  - file:///github/ahpapp/src/useResourceAuth.ts#L28-L44 - `saved`, `sendSaved` and `forget`, the reference's kept copy
  - file:///github/ahpapp/src/components/ResourceAuth.tsx#L64-L74 - closing drops every draft
---

## Context

The reference client keeps a token per resource and offers to send the saved one again, which is what makes a second refusal cheap to answer.
In this protocol the credential is not this client's to keep: `authenticate` pushes it to the host, and the host holds it for the connection, so a copy in the client is a second copy with the same lifetime and one more place a secret can be read from.
The store is a plain object any screen binds to, and the config file is world-readable JSON.

## Decision

The prompt holds what was typed only until it is submitted.
On an accepted credential the field is cleared and the secret is not written anywhere else.
Nothing is persisted, so a reconnect the host has forgotten prompts again.

## Consequences

There is exactly one copy of the secret after a successful sign-in, and it is the host's.
A second refusal for the same resource in the same connection does not need a token at all, because the host already holds one, so the common case the reference's saved copy is for does not arise here.
A reconnect that loses the credential costs one retype rather than a secret sitting in memory for the life of the screen.

## Options

- **Keep it in the store for this connection.** Rejected: the host already holds it, and the only thing gained is not retyping in a case the host makes unnecessary, at the cost of a secret readable by every screen and every test dump.
- **Write it to the config file.** Rejected: `ahpc` has no secret store, and a token in `config.json` is a token in a file people share, back up and paste into issues.
- **Keep it in an environment variable for the process.** Rejected: the screen does not own the child processes a session starts, and an environment is harder to clear than a field.
