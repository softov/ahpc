---
title: A command that dispatches an action waits for the host's answer - implemented
date: 2026-10-30
refs:
  - git://84b3a8b
  - "[code://src/ahp/connection.ts](../../../../src/ahp/connection.ts)"
  - "[code://src/ahp/channels.ts](../../../../src/ahp/channels.ts)"
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts)"
  - "[code://src/cli/main.ts](../../../../src/cli/main.ts)"
  - "[code://src/mcp/tools.ts](../../../../src/mcp/tools.ts)"
  - "[code://test/dispatch.test.ts](../../../../test/dispatch.test.ts)"
---

A command that sends an action now ends with the host's answer rather than with the send: the shell exits 0 when the host applied it, and prints the host's own reason on stderr and exits 1 when it did not. `queue` prints the id of the message it queued, `unqueue` takes that id back, and `cancel` says one line whether it stopped a turn or not. The same answers reach a model through the MCP tools, and a `prompt` whose turn was cancelled now says so instead of ending with a bare 1.

## What was built

- `src/ahp/connection.ts` - `Sent` is the answer of a dispatch: `refused` is the host's words for why it did not apply the action, and absent means it did. `setArchived`, `setRead`, `writeTerminal`, `queue`, `unqueue`, `confirmToolCall` and `completeInput` resolve it; `stopTurn` resolves `{ cancelled, refused? }`.
- `src/ahp/channels.ts` - a map from `clientSeq` to a waiter, settled by an action envelope whose origin names this client; a rejection a waiter takes is not also reported to `onRejection`, `await` resolves a refusal at the deadline, and `detach` answers every waiter rather than leaving it to the deadline.
- `src/ahp/live.ts` - `sent` holds the channel, dispatches, waits up to 10 seconds and releases; `answered` looks the session's chat up first and routes the chat actions through it. The seven methods go through them, `queue` makes its id before sending, and `stopTurn` reports what the host said instead of telling `onRefusal`.
- `src/ahp/fake.ts` - the seven resolve at once, with a refusal for an id the script is not holding.
- `src/cli/main.ts` - `exitOf` is the one place a command turns an answer into an exit code and one stderr line. `queue` prints the id, or `{ "id": ... }` under `--json`; `cancel` prints `refused`, `No turn is running.`, or nothing; `prompt` prints `The turn was cancelled.` for a turn that came back cancelled.
- `src/mcp/tools.ts` - `applied` throws the refusal as the tool's error, which the server already turns into `isError` content. `queue_turn` answers `{ queued: true, id }`, and `cancel_turn` answers `{ cancelled }`.
- `src/control.ts` and `src/terminal.ts` - the screen does not wait, and `told` draws a refusal on the error line.
- `docs/subjects/TURNS.md` - says that `queue` prints the id and that each command exits with the host's answer.
- `test/scenario.ts` - the scripted host gained an opt-in `echo`, which is the protocol's reconciliation rule and the only answer a dispatch has.
- `test/dispatch.test.ts`, `test/cli.test.ts`, `test/mcp.test.ts`, `test/oneshot.test.ts` - the cases in each task's Validation.

## Verified

- `test/cli.test.ts`: 46 tests green, including the five new cases for the queue id, the `--json` id and the three refusals.
- `test/mcp.test.ts`: 38 tests green, including the `queue_turn` id and the refused `confirm_tool_call`.
- `test/oneshot.test.ts`: 13 tests green, including `cancel` on a session with no chat and `prompt` cancelled by another client's action.
- `test/dispatch.test.ts`: 5 tests green.
- `npm run typecheck`: clean.
- `npm test`: 817 tests, 816 passed. The one failure is `test/smoke.test.tsx > the composer is the front door > puts where the session runs on a row of its own`, which expects the checkout directory to be named `ahpc` and is at `build-agents-99b61ae4` in this worktree; the same test fails on `main` here, and nothing in this plan touches it.
- By hand against ahpd `main` on 2026-11-03: `queue` printed an id, and `unqueue` of that id exited 0.
- By hand on 2026-11-03: `unqueue`, `confirm` and `answer` with an unknown id printed the host's reason and exited 1.
- By hand on 2026-11-03: `cancel` on an idle session printed "No turn is running." and exited 1.
- Seen on 2026-11-03: a bad terminal URI prints two lines, the subscribe error and the rejection.

## Departures from the plan

- Task 01 step 6 changed `dispatch` itself to the waiting send; `dispatch` is also `setDraft`, `say` and `steer`, and a draft is debounced on every keystroke, so waiting there would hold a channel per keystroke and claim a `steer` refusal the screen needs. `dispatch` stays fire-and-forget for those three and the waiting send is the separate `sent`/`answered` pair.
- `inFlight` was widened to `Set<Promise<unknown>>`, so `flush` also waits for a waiting send.
- The main.ts helper's name and the MCP one are `exitOf` and `applied`, matching the verbs the surrounding helpers use rather than the names the task implied.
- The no-chat cancel sentence is new wording, `This session has no chat to stop a turn in.`, because the plan asked for one line and the sibling fallback in `answered` is a fragment of a sentence.
- The prompt-cancelled case is driven by another client's `chat/turnCancelled` action on the chat, which the SDK reducer turns into a turn in state `cancelled`; the command path is the one a host's own action takes.

## Left for later

- None.
