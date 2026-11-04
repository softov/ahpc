---
title: A still waits for the host to answer before it draws
domain: screen
status: planned
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
refs:
  - git://e8c5a80 - the commit the facts were checked at, and the last commit that holds briefs/doc-pictures-come-from-a-seeded-test-host.md
  - "[code://src/tui.tsx#L273-L345](../../../../src/tui.tsx#L273-L345) - `still`, which draws once `renderStill` reports the screen settled"
  - "[code://src/ahp/live.ts#L2062](../../../../src/ahp/live.ts#L2062) - `inFlight`, which holds only dispatches that have not left yet"
  - "[code://src/ahp/live.ts#L3460](../../../../src/ahp/live.ts#L3460) - `flush`, which waits on `inFlight`"
  - "[code://src/ahp/live.ts#L1621](../../../../src/ahp/live.ts#L1621) - where the client that sends every request is made"
  - "[code://src/ahp/connection.ts#L595](../../../../src/ahp/connection.ts#L595) - `flush` on the seam"
---

## Goal

A still against a live host draws once the host has answered what the screen asked.
On 2026-11-04, a still of the changes screen said "Nothing changed", while `ahpc changes` listed three files from the same host at the same moment.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `rg "inFlight" src/ahp/live.ts` - only `dispatch` and `answered` add to it; a read such as `changesets` or a folder listing does not.
- A still of the `changes` and `files` screens against the `notes` example host drew both empty.

### Runtime path

```
still -> renderStill: start, before, settled -> host answers later -> the frame is already drawn
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| A still waits on the requests in flight, with a cap | Softov, 2026-11-04: "Wait on requests in flight" | 01 |
| The live connection counts every request and subscribe until it is answered or refused | (defaulted: a read is what a screen waits on, and only the connection sees all of them) | 01 |
| The seam gets `idle(limitMs)`, which resolves when nothing is open or the limit passes | (defaulted: a still and a command can both ask it; the scripted host answers at once) | 01 |
| The still waits in turns: the screen settles, the host goes idle, and again, until neither changes | (defaulted: an answer draws a screen that asks the next question) | 01 |
| The cap is 10 seconds in all, and a still that reaches it draws what it has | (defaulted: a slow host gives a partial picture, not a hang) | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The still waits on the host](task-01-the-still-waits-on-the-host.md) | todo | - |

## Risks and tradeoffs

- A screen that keeps asking never goes idle. The cap ends the wait.

## Resume state

- **Done so far:** planned 2026-11-04.
- **Next action:** [task-01-the-still-waits-on-the-host.md](task-01-the-still-waits-on-the-host.md).
- **Open questions:** none.
- **Watch out for:** a subscription stays open after its snapshot, so only the subscribe request counts, not the channel.

## Final verification checklist

- [ ] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
- [ ] Against the demo host, a still of the `changes` screen lists the changed files.
