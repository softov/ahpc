---
title: "`prompt` on a busy session refuses, queues or steers, and says when it stops waiting"
domain: cli
status: active
priority: high
created: 2026-10-14
revalidated: 2026-10-14
requires: []
changes: []
creates: []
decisions: []
refs:
  - "[code://src/wait.ts#L122-L200](../../../../src/wait.ts#L122-L200) - `turn`, which sends with `host.say` without a look at the active turn"
  - "[code://src/cli/main.ts#L1575-L1606](../../../../src/cli/main.ts#L1575-L1606) - `run` and `prompt`, with the 900 second default and no line on timeout"
  - "[code://src/mcp/tools.ts#L285-L310](../../../../src/mcp/tools.ts#L285-L310) - the MCP prompt tool, which calls the same `turn`"
  - "[code://src/ahp/connection.ts#L340-L353](../../../../src/ahp/connection.ts#L340-L353) - `say` and `queue`; no `steer`"
  - "[code://src/ahp/live.ts#L3015-L3031](../../../../src/ahp/live.ts#L3015-L3031) - `queue` as `chat/pendingMessageSet` kind `queued`, the pattern `steer` mirrors"
  - "[code://src/ahp/fake.ts#L1992](../../../../src/ahp/fake.ts#L1992) - the scripted host's `queue`"
  - "[code://src/control.ts#L924-L938](../../../../src/control.ts#L924-L938) - the screen, which queues when a turn is running"
---

## Goal

`ahpc prompt` never starts a second turn on a session whose turn is running.
Without a flag it refuses with one line and exits 1.
`--queue` sends the message behind the running turn and waits for the turn it starts.
`--steer` sends the message into the running turn and waits for that turn to end.
When `prompt` stops waiting before the turn ends, it says so on stderr.

## Reconnaissance

### Searches performed

- `rg "steer" src` - nothing; ahpc cannot send a steering message.
- `rg "runTurn" src` - `src/cli/main.ts` and `src/mcp/tools.ts`, both through `turn` in `src/wait.ts`.
- Found on 2026-10-14. A build turn ran past 900 seconds, and `prompt` exited 1 with no line.
- A second `prompt` then went into the running turn. ahpd then dropped the first turn from the session's history.

### Runtime path

```
prompt -> turn() -> until() subscribes -> host.say at once -> chat/turnStarted on a busy session
```

### Gaps

- `turn` sends before it reads the first snapshot, so it cannot know whether a turn is running.
- `turn` takes "finished" to mean an agent turn that was not in the baseline. The running turn is not in `turns`, so with `--queue` its end would count as the answer. The running turn's id must join the baseline.
- `HostConnection` has no `steer`.

## Answers

| What | Source | Task |
| --- | --- | --- |
| Plain `prompt` on a session with a running turn refuses with one line on stderr and exits 1 | Softov, 2026-10-14, "could have like a option so can queue/steer if its running?", then "Refuse with a line" | 01 |
| `--queue` sends with `chat/pendingMessageSet` kind `queued`, and `--steer` with kind `steering` | Softov, 2026-10-14, same question | 01 |
| With `--steer`, `prompt` waits for the running turn and prints it as the answer | (defaulted: the steered message has no turn of its own) | 01 |
| The MCP prompt tool gets the same behaviour, with an optional `busy` input of `queue` or `steer` | (defaulted: the tool and the shell share `turn` and must agree) | 01 |
| The scripted host refuses a turn on a busy session, as ahpd does after host/87 | Softov, 2026-10-14, "also on ahpc" | 01 |
| On timeout, `prompt` writes one line on stderr that it stopped waiting and the turn still runs | (defaulted: the first fix the problem named) | 02 |

## Proposed architecture

- **Data flow** - `turn` takes `busy?: 'queue' | 'steer'`. It sends nothing until the first snapshot or event says whether a turn is active. Then it calls `say`, `queue` or `steer`, or it answers with a refusal.
- **Event flow** - `steer` dispatches `chat/pendingMessageSet` with kind `steering`. A host refusal arrives as the existing refusal path.
- **State flow** - the baseline holds the ids in `turns` and, when one runs, the id of the active turn. `--steer` waits for that id to end instead.
- **Layer responsibilities** - `src/wait.ts`: the busy check and the wait · `src/ahp/*`: `steer` · `src/cli/main.ts`: flags, the refusal line, the timeout line · `src/mcp/tools.ts`: the `busy` input.
- **Source-of-truth files** - [`code://src/wait.ts`](../../../../src/wait.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - A busy session is refused, queued behind or steered](task-01-a-busy-session-is-refused-queued-or-steered.md) | implemented | - |
| [02 - A timeout says the turn still runs](task-02-a-timeout-says-the-turn-still-runs.md) | implemented | - |

## Risks and tradeoffs

- With `--steer`, the answer is the whole running turn, including the text from before the message. A caller who wants only the reply to the steer cannot separate it. That is acceptable for a first version.
- A turn can end between the first snapshot and the send. Then `--queue` starts at once and `--steer` gets the host's refusal. Both are correct outcomes.

## Resume state

- **Done so far:** planned 2026-10-14. Tasks 01 and 02 are implemented on 2026-10-14: `turn` reads the session before it sends, and `prompt` takes `--queue` and `--steer`. The MCP `send_turn` tool takes `busy`, the seam and both hosts have `steer`, and a timeout writes its line on stderr.
- **Next action:** review tasks 01 and 02, then the hand check against ahpd.
- **Open questions:** none.
- **Watch out for:** the scripted host sends events, not only snapshots, so the busy check reads both vocabularies.
  `live.ts` never sends `turnComplete`, so a wait that watched only for one would hang against a real host.
  The typed suite has one failure in `test/smoke.test.tsx` at this commit in this worktree, which is the composer chip drawing the worktree's own directory name.

## Final verification checklist

- [ ] A test: plain `prompt` on a busy session returns 1, writes the refusal line, and sends nothing.
- [ ] A test: `--queue` waits for the new turn, not the running one.
- [ ] A test: `--steer` dispatches kind `steering` and returns the running turn.
- [ ] A test: the MCP tool refuses without `busy`, and queues with `busy: queue`.
- [ ] A test: a timeout writes the stderr line.
- [ ] `npm run typecheck` and `npx vitest run` pass.
- [ ] `plans/index.md` updated.
