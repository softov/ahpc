---
title: Read the connection token from the file the host keeps it in
domain: ahp
status: built
priority: medium
created: 2026-09-24
revalidated: 2026-09-24
requires: []
changes: []
creates: []
decisions:
  - decisions/the-client-reads-a-token-file-and-never-writes-one.md
refs:
  - "[code://src/config.ts#L8-L30](../../../../src/config.ts#L8-L30) - `Config`, where every key is what a flag would have said"
  - "[code://src/cli/main.ts#L226-L245](../../../../src/cli/main.ts#L226-L245) - `where`, the shell's resolution of host and token"
  - "[code://src/tui.tsx#L340-L350](../../../../src/tui.tsx#L340-L350) - the screen's, which held its own copy of the same order"
  - "[code://src/flags.ts#L44-L67](../../../../src/flags.ts#L44-L67) - `SWITCHES`, the valueless flags, which this one must stay out of"
  - "[code://test/cli.test.ts](../../../../test/cli.test.ts) - the two front ends' argument handling, which nothing else reaches"
  - file:///github/ahpd/packages/server/src/main.ts#L378-L404 - the host's `secret`, which writes the file this reads
  - file:///github/externals/vscode/src/vs/platform/agentHost/node/agentHostServerMain.ts#L110-L148 - the editor's host flags, and the names this takes
---

## Goal

A person points this client at a host by naming the file the host keeps its connection token in, rather than by copying the secret out of that file into a flag, a variable or `config.json`.
The host has had `--connection-token-file` for as long as it has had a token, and writes a fresh secret there when the file is absent; this client had no way to read what it wrote.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "AHPC_TOKEN|file.token" src/` - the connection token is resolved in two places, `src/cli/main.ts:229` for the shell and `src/tui.tsx:342` for the screen, each with its own copy of the same three-source order.
- `rg -n "connection-token" /github/ahpd/packages/server/src/main.ts` - the host takes `--connection-token`, `--connection-token-file` and `--without-connection-token`, refuses the first two together, trims what it reads, refuses an empty file, and writes a fresh token at `0600` when the file is not there.
- Read `agentHostServerMain.ts:110-148` in the editor - the same three flags with the same names and the same mutual exclusion, which is where the host's spelling comes from.
- Read the SDK's `ws/transport.d.ts` - its options carry `protocols` only, and its comment says browsers cannot set arbitrary headers, so `?tkn=` is the transport's extension point rather than a choice this client made.

### Runtime path

```
ahpc --connection-token-file <p> -> connectionToken({ tokenFile }, file) -> readTokenFile(p) -> trim
  -> Where.token -> connect -> liveHost -> endpoint ?tkn=<secret> -> the host compares it
```

### Gaps

- No way to read a token from a file, in either front end.
- The order of sources was written twice and could drift, which the screen's own comment already worried about.
- `Not found: any config key naming a file rather than a secret - searched "File" in src/config.ts.`

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| 1 | [The client reads a connection token file and never writes one](../../../decisions/the-client-reads-a-token-file-and-never-writes-one.md) | Softov, 2026-09-24: "yes.. the flag for the file implement". |

What this plan settled without one:

| What | Source | Task |
| --- | --- | --- |
| Both front ends resolve through one function in `src/config.ts`, which both already import, rather than each keeping its own order | `code://src/tui.tsx#L340-L350` | 01 |
| The config key is `connectionTokenFile`, the name the host's own configuration uses for the same thing | `file:///github/ahpd/packages/server/src/config.ts#L19` | 01 |
| Within the config file the path beats the written-down secret, because somebody who set both has said where they are moving to | decision 1 | 01 |

## Proposed architecture

- **Data flow** - `connectionToken(said, file)` in `src/config.ts` answers with the secret to present, from the most deliberate source that has one. `readTokenFile` is the only thing that opens the file.
- **Layer responsibilities** - `src/config.ts`: the order, the file and the refusals · `src/cli/main.ts`: the flag, the help line, and turning a refusal into a `Fault` · `src/tui.tsx`: the flag, the usage line, and the same call.
- **Source-of-truth files** - [`code://src/config.ts`](../../../../src/config.ts).

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The flag, in both front ends](task-01-the-flag-in-both-front-ends.md) | done | - |

## Risks and tradeoffs

- A path in `config.json` looks like the secret being in `config.json`.
  It is not, and the key's own documentation says so: a path is not a credential, which is the whole reason the key can live in a file people share.
- A refusal in the screen prints a stack rather than a sentence, because the screen has no `Fault` handling.
  Left as it is: `loadConfig` has always behaved that way there, and giving the screen its own error surface is a larger change than this one. Noted in [implemented.md](implemented.md).
- A rejected connection token reads exactly like an unreachable host.
  Out of scope here and recorded in the idea [finding a host without being told](../../../ideas/finding-a-host-without-being-told.md).

## Resume state

- **Done so far:** the one task, on 2026-09-24, verified against a running `ahpd`.
- **Next action:** none. The plan is built.
- **Open questions:** none.
- **Watch out for:** `--connection-token-file` takes a value, so it must never enter `SWITCHES` or the word after it is read as a command. `test/cli.test.ts` asserts both halves of that.
  This is the *connection* token and not the resource token that [ahp/02](../02-a-token-before-the-host-refuses/plan.md) is about; the two are close enough that merging them is the obvious mistake.

## Final verification checklist

- [x] `ahpc --connection-token-file <p>` reads the file `ahpd --connection-token-file <p>` wrote, against a running host.
- [x] A wrong token and a missing token are both refused by that host, so the success above means something.
- [x] The two flags together are refused with a sentence, and the command exits 1.
- [x] A missing file is refused and is not created.
- [x] A trailing newline is trimmed, which is what the host writes.
- [x] Both front ends parse and document it, and it is not in `SWITCHES`.
- [x] `npm test` green, 594 tests. `npm run typecheck` green.
- [x] `plans/index.md` carries the row.
