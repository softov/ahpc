---
title: The changes list follows the host while the screen is open
domain: screen
status: built
priority: high
created: 2026-11-03
revalidated: 2026-11-03
refs:
  - git://2060e54 - the commit of this repository the facts were checked at
  - git://296c9b01 - the ahpd commit read for the changeset actions
  - "[code://src/screens.tsx#L1270-L1280](../../../../src/screens.tsx#L1270-L1280) - the changes screen reads the chosen changeset once, when the scope changes"
  - "[code://src/ahp/live.ts#L2669-L2704](../../../../src/ahp/live.ts#L2669-L2704) - `watchTerminal`, which holds a channel and applies `terminalReducer`: the pattern to copy"
  - "[code://src/ahp/live.ts#L3253-L3263](../../../../src/ahp/live.ts#L3253-L3263) - `changes`, which reads a snapshot and lets the channel go"
  - "[code://src/ahp/live.ts#L1346](../../../../src/ahp/live.ts#L1346) - `changeset`, the decoder of a changeset state"
  - "[code://src/ahp/channels.ts#L62](../../../../src/ahp/channels.ts#L62) - `open`, a hold that hands a consumer the snapshot and each action"
  - "[code://src/ahp/fake.ts#L2188-L2292](../../../../src/ahp/fake.ts#L2188-L2292) - the fake's `review` and `invoke`, which send a `changes` event on the session that `live.ts` never sends"
  - "[code://src/ahp/connection.ts#L176](../../../../src/ahp/connection.ts#L176) - `watchTerminal` on the seam"
  - "[code://src/control.ts#L246](../../../../src/control.ts#L246) - `Controller.changesAt`"
  - npm://@microsoft/agent-host-protocol@^1.0.0 - `changesetReducer`
  - "file:///github/ahpd/packages/sdk/src/host/changesets.ts - ahpd dispatches `fileSet`, `fileRemoved`, `cleared`, `statusChanged` and `operationsChanged` to the changeset channel"
---

## Goal

The changes list shows what the host says while the screen is open.
On 2026-11-03, Softov committed from the changes screen against ahpd, and the list did not change.
The list changed only after `]` moved the scope, which read the changeset again.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `grep -n "type: 'changes'" src/ahp/live.ts` - no match; the live host sends no `changes` event.
- `grep -n "emit(at.owner, { type: 'changes'" src/ahp/fake.ts` - 3 matches; the fake redraws after a verb and a tick, so the tests pass.
- `grep -n "dispatch(channel" ahpd/packages/sdk/src/host/changesets.ts` - ahpd sends the changeset actions after each change of the tree.

### Runtime path

```
commit -> invokeChangesetOperation -> ahpd changes the tree -> changeset/fileRemoved ... on the changeset channel -> (nobody holds the channel)
```

### Gaps

- The changes screen holds no changeset channel, so no action reaches it.
- The review tick does not redraw against ahpd, for the same reason.
- An edit by the agent or another client does not show until the scope moves.

## Answers

| What | Source | Task |
| --- | --- | --- |
| The screen holds the chosen changeset's channel open and applies the host's actions | Softov, 2026-11-03: "Watch the channel" | 01, 02 |
| The seam method is `watchChanges(changeset, observer)`, the same shape as `watchTerminal` | `(defaulted: a second watch copies the first)` | 01 |
| The actions are applied with `changesetReducer` from the protocol package | `(defaulted: as `watchTerminal` applies `terminalReducer`)` | 01 |
| The fake's `review` and `invoke` tell the watchers of the changeset, not the session | `(defaulted: the fake does what the live host does)` | 01 |
| `changesAt` stays for the shell, which reads once | `(defaulted: the shell prints and exits)` | 02 |
| The fake's `changes` event at the end of a turn stays | `(defaulted: out of this plan)` | - |

## Proposed architecture

- **Data flow** - `watchChanges` opens the channel through `channels.open`. The snapshot and each reduced action go to the observer as a `Changeset`.
- **State flow** - the changes screen writes each `Changeset` to `CHANGES`, and closes the watch when the scope or the session changes.
- **Layer responsibilities** - `src/ahp/live.ts` and `src/ahp/fake.ts`: the watch · `src/control.ts`: `Controller.watchChanges` · `src/screens.tsx`: the effect.
- **Source-of-truth files** - [`code://src/ahp/live.ts`](../../../../src/ahp/live.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The hosts watch a changeset](task-01-the-hosts-watch-a-changeset.md) | done | - |
| [02 - The changes screen watches its changeset](task-02-the-screen-watches-its-changeset.md) | done | 01 |

## Risks and tradeoffs

- The screen holds one more channel while it is open, and lets it go after the linger.
- A refusal of the changeset channel reaches the status row as the host's message, with no action name.

## Resume state

- **Done so far:** tasks 01 and 02 done, as [implemented.md](implemented.md) says. Softov checked them against ahpd on 2026-11-04.
- **Next action:** none.
- **Open questions:** none.
- **Watch out for:** the fake's session `changes` event also writes `CHANGES`; a test that passes through it does not test the watch.

## Final verification checklist

- [x] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
- [x] Against ahpd, a commit from the changes screen empties the list without `]`.
- [x] Against ahpd, `r` ticks a file off and the tick shows.
