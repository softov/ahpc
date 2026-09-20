---
name: do-check
description: Check what VS Code's agent host changed since this repository last read it, and decide what each change asks of this repository. Use when asked to do a pass against the reference host, to check upstream, to see what VS Code's agentHost changed, or to catch up with the reference after a VS Code update.
---

# Checking against the reference host

The reference is VS Code, at `/github/externals/vscode`, read but never imported or built against: the other implementation of the same protocol, and the one to check a design against. The revision last read is a line in `REFERENCE.md`, because it moves every pass and this skill does not.

## Two repositories

`ahpd` checks what a change asks of the host, `ahpc` what it asks of the client; they are separate because they share no package. A protocol change usually bears on both and is checked twice: once for what the host must serve, once for what the client must read. This skill is the same file in both, so a change to it is copied across before the pass ends.
## Where the reference is

`REFERENCE.md` is the entry to both outside things: the clone, which it says how to make, and the protocol repository behind the vendored snapshot, the authority on what an action means.

The clone is sparse and partial, and this is the method's one trap: a path left out of the set is not in the working tree, so it lists nothing and a search finds nothing either, silently. `git sparse-checkout list` says what is there; add what is missing before reading it, and never take "no match" for "not used" until the path that symbol would live in is checked out. A whole client can hide this way.

| path, under `/github/externals/vscode/` | what it settles | read next in this repository |
| --- | --- | --- |
| `src/vs/platform/agentHost/common/state/protocol/` | the wire. Read it first; everything else implements it. `.ahp-version` is the vendored revision | `ahpd`: `packages/sdk/src/types/`, `packages/sdk/src/host.ts`; `ahpc`: `src/ahp/types.ts` |
| `src/vs/platform/agentHost/node/protocolServerHandler.ts` | the host's request router: what a host must answer | `ahpd`: `packages/sdk/src/host.ts` |
| `src/vs/platform/agentHost/common/serverToolNames.ts`, `node/shared/sessionServerTools.ts` | the tools a host gives the agent and what each does | `ahpd`: `packages/sdk/src/sessiontools.ts`, `packages/sdk/src/tools.ts` |
| `src/vs/platform/agentHost/node/claude/` | the same job `ahpd`'s Claude backend does | `ahpd`: `packages/agent-claude/src/` |
| `src/vs/sessions/` | the Sessions window, the reference client now: `contrib/providers/agentHost/` is its provider and its pickers, built from the host's session config schema | `ahpc`: `src/control.ts`, `src/state.ts`, `src/blocks.ts` |
| `src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/` | the older window's client half: what it sends and reads back | `ahpc`: `src/ahp/connection.ts`, `src/state.ts` |
| `src/vs/workbench/contrib/chat/{common,browser/actions,browser/chatSessions}/` | the rest of the chat workbench that tree reads | `ahpc`: `src/blocks.ts`, `src/screens.tsx`, `src/mcp/tools.ts` |

## File references

Every item carries both files: the one that settles it and the one it would change. This lets a plan be written without reading upstream again.

- Cite the reference relative to the clone root, with the revision and a line or symbol: `node/claude/session.ts:412` at `<rev>`. A bare commit hash is not a reference.
- Cite the local side the same way, relative to this repository's root: the file the change lands in or would land in.
- An item with no reference, or no local destination, is not understood: it belongs under Left open, not Taken.

## What a pass writes down

The order is the order of work, so the next pass reads a decision rather than re-derives it.

- **Taken**: what this repository will now do.
- **Read and not taken**: what was read and is not being done, each with its reason and reference - the list that keeps the next pass cheap.
- **Already had**: what this repository already serves, with the commit that landed it. A ticked box is worth re-checking against the code: there an unimplemented claim hides.
- **Left open**: what could not be judged from the reference alone, and what would settle it.

## How to check

1. Read the last revision in `REFERENCE.md`, check the trees it names are checked out, then fetch and read what moved:

   ```bash
   cd /github/externals/vscode
   git fetch --depth=200 origin main
   git log --oneline <last>..HEAD -- src/vs/platform/agentHost
   git log --oneline <last>..HEAD -- src/vs/workbench/contrib/chat src/vs/sessions
   ```

2. Read the wire first, then the reference host, then the client. Upstream `.md` files were reflowed to one-line paragraphs, so read one with `git diff --word-diff`; a plain diff of it is the whole file.
3. Ask of every change: does a host draw or offer this, or does the window send or read it? Adopt it only when the reference window can do something from it that this repository cannot, or the protocol requires it.
4. Check the claim in the code, not the statement. A commit message is a note about intent; the file and the conformance cases are the check.

## Where the record goes

The pass is written under `.project/review/` with the file references above; accepted work becomes a plan, by `do-spec`.

| what | where |
| --- | --- |
| the pass itself | `.project/review/<YYYY-MM-DD>-<slug>.md` |
| the running list per area | `UPSTREAM.md` at the root: one section per pass, a box per item, ticked by the commit that lands it |
| the revisions last read against | `REFERENCE.md` at the repository root, updated at the end of a pass |
| a decision, or a plan | `.project/decisions/` and `.project/plans/`, by the `do-spec` skill |

One review file means one pass, dated the day it was made, never edited to hide what it said. A pass takes its number from `UPSTREAM.md`: read the last one there and use the next.
