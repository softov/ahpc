---
title: A resource token is kept for the process and never written down
status: accepted
date: 2026-09-24
supersedes: decisions/a-token-is-kept-in-a-file-of-its-own.md
refs:
  - "[code://src/ahp/auth.ts#L87-L109](../../src/ahp/auth.ts#L87-L109) - `authRequiredOf`, which reads a `-32007` and is what tells a bad credential from a bad request"
  - "[code://src/cli/main.ts#L229](../../src/cli/main.ts#L229) - the *connection* token, a different thing with the same word on it"
  - "[code://src/cli/main.ts#L1324-L1327](../../src/cli/main.ts#L1324-L1327) - `tokenVariable`, which derives `AHPC_TOKEN_<RESOURCE>`"
  - "[code://src/ahp/live.ts#L1386-L1387](../../src/ahp/live.ts#L1386-L1387) - `endpoint`, where the connection token is baked in once for the life of the process"
  - "[code://src/ahp/live.ts#L1748-L1760](../../src/ahp/live.ts#L1748-L1760) - the reconnect loop, which reuses that endpoint and never returns to `connect`"
  - file:///github/ahpd/packages/sdk/src/host.ts#L5647 - the host's answer to a credential it does not know, which is a `-32007`
  - file:///github/ahpd/packages/sdk/src/host.ts#L5589 - its answer to a resource it does not advertise, which is a `-32602` and not a bad token
  - file:///github/ahpapp/src/useResourceAuth.ts#L110-L121 - `sendSaved`, the reference's re-send, reached only by a person pressing it
---

## Context

This client holds two different things people call a token.
One is the **connection** token, which goes into the endpoint at `src/ahp/live.ts:1386` and is reused by every reconnect, so it already lasts as long as the process and needs nothing done to it.
The other is a **resource** token, the credential `authenticate` pushes when a host refuses with `-32007`, and it is the only one this plan is about.
Keeping the two apart is a standing rule here, and the words are close enough that merging them is the obvious mistake.

The resource token was going to be written to a file of this client's own, which would have matched ahpx and put a plaintext credential on disk for the first time.
Weighing it again, the thing that actually hurts is not that a person retypes between runs: it is that a reconnect loses the host's copy and this client has nothing to push, because the host keeps credentials per connection and ahpc's reconnect loop never returns to `connect`.
A cache that lives as long as the process fixes that completely, and a file buys only the gap between one run and the next, at the cost of backups, sync, `grep`, sibling processes and everything else that reads a home directory.
The environment variable already covers the between-runs case for anybody who wants it covered.

## Decision

A resource token is held in memory for the life of the process and is never written to disk.
It is resolved from `AHPC_TOKEN_<RESOURCE>` and then from that in-memory cache, and a credential the host accepts is put in the cache.
It is pushed again, without asking, whenever a connection is made or remade, because the host drops what it holds when a socket closes.
It is dropped from the cache on the first **authentication** failure, meaning a rejection that reads as a `-32007`, and kept on anything else: a wrong resource answers `-32602` and a dropped link answers nothing, and neither says the credential is bad.
This client reads `AHPC_TOKEN_<RESOURCE>` and never sets an environment variable of its own.

Source: Softov, 2026-09-24: "no file write.. memory", "we store process lifetime. repush.. and if 1th failure in auth (not a generic error) we forget", and "Keep reading it, never write one".

## Consequences

The reconnect hole closes, which was the real defect, and no credential outlives the process.
A person still types a token once per run unless they exported the variable, which is the price of writing nothing down and is accepted.
The cache is a private map inside `src/ahp/tokens.ts`, never the reactive store, so the superseded reasoning about a secret every screen binds to and every test dump prints still holds and is still honoured.
A host whose authentication is briefly broken can answer `-32007` to a good credential and cost the person one retype; that is a prompt rather than a lockout, and is accepted rather than engineered around.
Never setting a variable matters more than it looks: a session spawns child processes that inherit this client's environment, which is exactly why the first decision in this chain rejected an environment variable as a place to keep anything.

## Options

- **A file of this client's own, at 0600.** Rejected after being accepted earlier the same day: it is ahpx's posture and weaker than ahpapp's Keychain, and it trades a plaintext credential on disk for the one case the environment variable already covers.
- **A system keyring.** Rejected for now for the same reason as before, a dependency and a platform matrix, and now also because nothing needs to survive the process at all.
- **Clear the cache whenever the socket drops.** Rejected: it is today's behaviour, and it leaves the reconnect hole this decision exists to close.
- **Re-prompt on reconnect instead of re-pushing.** Rejected: it is ahpapp's posture, where a person presses "Send the saved one", but a phone reconnects on a person's schedule and a terminal reconnects on the network's, so the same rule would mean a prompt every time a link flaps.
- **Forget on any failed push.** Rejected: a dropped link and a wrong resource are not a bad credential, and `-32602` against `-32007` is the host telling them apart for us.
