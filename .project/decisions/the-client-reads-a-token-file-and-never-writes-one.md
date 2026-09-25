---
title: The client reads a connection token file and never writes one
status: accepted
date: 2026-09-24
refs:
  - "[code://src/config.ts#L136-L175](../../src/config.ts#L136-L175) - `connectionToken` and `readTokenFile`, the one resolution both front ends use"
  - "[code://src/cli/main.ts#L226-L245](../../src/cli/main.ts#L226-L245) - `where`, the shell's half"
  - "[code://src/tui.tsx#L340-L350](../../src/tui.tsx#L340-L350) - the screen's half, which had its own copy of the order"
  - file:///github/ahpd/packages/server/src/main.ts#L378-L404 - `secret`, the host's side: it refuses the two flags together, trims what it reads, and writes a fresh token at 0600 when the file is absent
  - file:///github/externals/vscode/src/vs/platform/agentHost/node/agentHostServerMain.ts#L110-L148 - the editor's host flags, which this takes its names from
---

## Context

The host already keeps a connection token in a file: `ahpd --connection-token-file <p>` reads the secret there, and writes a fresh one at `0600` when the file is not there yet.
This client had no way to consume that file.
Its connection token came from `--token`, `AHPC_TOKEN`, or `token` in `config.json`, so the only way to use what the host wrote was for a person to open the file and copy the secret into one of those.
The last of the three is the worst of them: `config.json` is hand-edited, shared, backed up and pasted into issues, which is exactly the objection that kept resource tokens out of it.

A file is a different proposition here than it was for a resource token.
This client does not create the secret and does not own it: it reads a path somebody chose, holding a credential the host generated.
A flag carrying a path is safe in shell history, a unit file and a Dockerfile, where a flag carrying a secret is not.

## Decision

`--connection-token-file <p>` names a file to read the connection token from, and `connectionTokenFile` says the same thing in the config file, under the key name the host's own configuration uses.
What is read is trimmed, because the host writes a trailing newline and reads its own file back the same way.
A file that is missing or empty is refused with a sentence, and **never written**: the host generates this secret and the client presents it.
`--token` and `--connection-token-file` together are refused rather than ranked, which is what the host does with its own pair.
Nothing checks the token's shape, so whatever the host accepts is whatever this sends.

Source: Softov, 2026-09-24: "yes.. the flag for the file implement".

## Consequences

`ahpd --connection-token-file ~/.config/ahpc/host.token` and `ahpc --connection-token-file ~/.config/ahpc/host.token` are now the two halves of one arrangement, verified end to end against a running host.
A person can move the secret out of `config.json` and leave a path behind, which is the first time that was possible.
Both front ends resolve through one function, so the screen and the shell can no longer disagree about which credential to send.
The client gains no way to bootstrap a host it has never talked to, which is deliberate and is the cost of not writing.

## Options

- **Write a fresh token when the file is absent, as the host does.** Rejected: a host generating a secret is a host setting its own password, and a client doing it is inventing a credential nobody agreed to. The host would refuse it, and the person would be told the file is wrong rather than that the host never knew it.
- **Rank the two flags instead of refusing them.** Rejected: the host refuses them, the editor refuses them, and a silent preference makes one of the two flags do nothing while looking like it worked.
- **Validate the token's characters, as the editor does.** Rejected: the editor validates because it is generating and owning the token, while this end only presents one. A charset rule here could refuse a token the host is perfectly happy with.
- **Add it as a fourth tier under `--token`.** Rejected: that is the ranking above, spelled differently.
