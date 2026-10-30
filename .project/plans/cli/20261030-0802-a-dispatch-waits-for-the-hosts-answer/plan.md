---
title: A command that dispatches an action waits for the host's answer
domain: cli
status: planned
priority: high
created: 2026-10-30
revalidated: 2026-10-30
refs:
  - file:///github/ahp-review/briefs/ahpc-catch-up.md - the brief, "Bugs in ahpc"; its channels and `x-ahpd/*` commands are out of scope
  - git://30df635 - the ahp-review commit that holds the brief
  - "[code://src/ahp/live.ts#L2012-L2023](../../../../src/ahp/live.ts#L2012-L2023) - `dispatch`, which sends to the session's chat and resolves nothing"
  - "[code://src/ahp/live.ts#L2620-L2626](../../../../src/ahp/live.ts#L2620-L2626) - `writeTerminal`, a dispatch with no answer"
  - "[code://src/ahp/live.ts#L2739-L2749](../../../../src/ahp/live.ts#L2739-L2749) - `setArchived` and `setRead`, dispatches with no answer"
  - "[code://src/ahp/live.ts#L3024-L3105](../../../../src/ahp/live.ts#L3024-L3105) - `queue`, `unqueue`, `confirmToolCall` and `completeInput`; `queue` makes the id and never returns it"
  - "[code://src/ahp/live.ts#L3058-L3081](../../../../src/ahp/live.ts#L3058-L3081) - `stopTurn`, which resolves a boolean and never rejects, the shape to copy"
  - "[code://src/ahp/channels.ts#L216-L249](../../../../src/ahp/channels.ts#L216-L249) - `rejected` and `deliver`, where an envelope with `origin` arrives"
  - "[code://src/ahp/channels.ts#L264-L276](../../../../src/ahp/channels.ts#L264-L276) - `refuse`, the claimed-or-reported pattern a waiter reuses"
  - "[code://src/ahp/connection.ts#L73-L80](../../../../src/ahp/connection.ts#L73-L80) - `setArchived` and `setRead` return `void`"
  - "[code://src/ahp/connection.ts#L340-L373](../../../../src/ahp/connection.ts#L340-L373) - `stopTurn`, `queue`, `unqueue`, `confirmToolCall` and `completeInput`"
  - "[code://src/cli/main.ts#L1054-L1056](../../../../src/cli/main.ts#L1054-L1056) - `session read` and `session archive` return 0 at once"
  - "[code://src/cli/main.ts#L1320-L1325](../../../../src/cli/main.ts#L1320-L1325) - `terminal send` returns 0 at once"
  - "[code://src/cli/main.ts#L1620-L1679](../../../../src/cli/main.ts#L1620-L1679) - `prompt`, `cancel`, `queue` and `unqueue`"
  - "[code://src/cli/main.ts#L1728-L1747](../../../../src/cli/main.ts#L1728-L1747) - `confirm` and `answer` return 0 at once"
  - "[code://src/connect.ts#L99](../../../../src/connect.ts#L99) - `onRefusal` writes every refusal to stderr"
  - "[code://src/mcp/tools.ts#L346](../../../../src/mcp/tools.ts#L346) - `queue_turn` answers `queued: true` without the host"
  - "[code://src/wait.ts#L83-L85](../../../../src/wait.ts#L83-L85) - `failure`, which reads error parts only, so a cancelled turn says nothing"
  - npm://@microsoft/agent-host-protocol@^1.0.0 - `AhpClient.dispatch` returns a `DispatchHandle` with `clientSeq`
  - https://github.com/microsoft/agent-host-protocol/blob/main/docs/guide/reconciliation.md - an own action comes back with `origin.clientId` and `clientSeq`, or with `rejectionReason`
  - https://github.com/microsoft/agent-host-protocol/blob/main/docs/specification/chat-channel.md - the actions a host must or should reject
---

## Goal

A command that sends an action exits with the host's answer.
It exits 0 when the host applied the action.
It prints the host's reason and exits 1 when the host refused it.
`queue` prints the id of the queued message, so `unqueue` can use it.
`cancel` prints one message, and a cancelled `prompt` says so.
The MCP tools that dispatch answer the same way.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `rg -n "client.dispatch|dispatch\(uri" src/ahp/live.ts` - seven methods dispatch and return `void`: `queue`, `unqueue`, `confirmToolCall`, `completeInput`, `setRead`, `setArchived`, `writeTerminal`.
- `rg -n "host\.(queue|unqueue|confirmToolCall|completeInput|setRead|setArchived|writeTerminal)" src` - the callers are `cli/main.ts`, `mcp/tools.ts` and `control.ts`.
- `rg -n "clientSeq|rejectionReason" src/ahp` - `channels.ts` reads `rejectionReason` and the origin's `clientId`, never `clientSeq`.
- `rg -n "clientSeq" /github/ahpd/packages/sdk/src/host` - ahpd keeps `{ clientId, clientSeq }` as the origin of every echo.

### Runtime path

```
cli command -> HostConnection method -> client.dispatch -> clientSeq
host -> action envelope { origin, rejectionReason? } -> channels.deliver -> the waiter for clientSeq -> exit code
```

### Gaps

- No dispatch method resolves, so every command that dispatches exits 0, even when the host refused.
- A refusal reaches stderr through `onRefusal` after the command already chose its exit code, or never, when the process exits first.
- `queue` makes the message id in `live.ts` and returns nothing, so the id never reaches a person.
- `cancel` on a session with no chat prints the reason from `onRefusal` and then "No turn is running.".
- `failure` reads only error parts, so a `prompt` whose turn was cancelled exits 1 with no line.
- A host echoes an accepted action to the subscribers of its channel, so a waiter needs a subscription to the channel.

## Answers

| What | Source | Task |
| --- | --- | --- |
| Scope is AHP only: the bugs and fixes in ahpc. No `x-ahpd-*` channels and no `x-ahpd/*` commands. | Softov, 2026-10-30: "lets get only the ahp things.. no new channels for now.." | - |
| Users and teams are not in scope. | Softov, 2026-10-30: "not needed users, team control for now" | - |
| A dispatch method resolves `{ refused?: string }` and never rejects, as `stopTurn` does. | `(defaulted: the shape stopTurn already has)` | 01 |
| A dispatch matches its echo by `origin.clientSeq` from `client.dispatch`. | `(defaulted: the protocol's reconciliation rule)` | 01 |
| A dispatch holds its channel open until the echo arrives. | `(defaulted: a host echoes to the channel's subscribers)` | 01 |
| A dispatch with no echo after 10 seconds resolves `refused: "The host did not answer in 10 seconds."`. | `(defaulted: a command must end, and a silent host is not a yes)` | 01 |
| A refusal a waiter takes is not also sent to `onRefusal`. | `(defaulted: the claimed-or-reported pattern of refuse, and the double message of cancel)` | 01 |
| `queue` resolves `{ id, refused? }`, and the CLI prints the id on stdout. | The brief, "Bugs in ahpc" | 02 |
| A refused command prints the host's reason on stderr and exits 1. | The brief, "Bugs in ahpc" | 02 |
| The MCP tools that dispatch return the refusal as a tool error. | `(defaulted: the tools and the shell share the seam and must agree)` | 02 |
| The screen does not wait; it calls the methods with `void`. | `(defaulted: the screen already draws refusals through onRefusal)` | 02 |
| `cancel` prints one line when it cannot cancel. | The brief, "Bugs in ahpc" | 03 |
| A `prompt` whose turn was cancelled prints "The turn was cancelled." on stderr and exits 1. | The brief, "Bugs in ahpc" | 03 |
| The extra `failed` turn after a cancel is not in scope. | The brief says it is likely agent-claude, not ahpc | - |

## Proposed architecture

- **Data flow** - a dispatch method sends with `client.dispatch` and keeps the `clientSeq`. It waits for the envelope whose origin names this client and that number.
- **Event flow** - `channels.deliver` gives each envelope with this client's origin to `settle(clientSeq, rejectionReason)`. A waiter that takes a rejection claims it, and `onRejection` is not told.
- **State flow** - a map from `clientSeq` to a resolver, in `openChannels`. A reconnect resolves every waiter with the refusal the dropped connection gives.
- **Layer responsibilities** - `src/ahp/channels.ts`: match echoes to waiters · `src/ahp/live.ts`: send, hold the channel, wait · `src/ahp/fake.ts`: answer at once · `src/cli/main.ts` and `src/mcp/tools.ts`: print and exit.
- **Source-of-truth files** - [`code://src/ahp/connection.ts`](../../../../src/ahp/connection.ts), [`code://src/ahp/channels.ts`](../../../../src/ahp/channels.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - A dispatch resolves on its echo](task-01-a-dispatch-resolves-on-its-echo.md) | todo | - |
| [02 - A command exits with the host's answer](task-02-a-command-exits-with-the-answer.md) | todo | 01 |
| [03 - A cancel says one thing](task-03-a-cancel-says-one-thing.md) | todo | - |

## Risks and tradeoffs

- A host that never echoes makes a command wait 10 seconds and fail - ahpd and VS Code echo each own action.
- A waiter subscribes to a channel the command did not open - it releases the channel when the echo arrives.
- Seven methods change their return type - the screen ignores the promise, so its behaviour stays the same.

## Resume state

- **Done so far:** planned 2026-10-30.
- **Next action:** [task-01-a-dispatch-resolves-on-its-echo.md](task-01-a-dispatch-resolves-on-its-echo.md).
- **Open questions:** none.
- **Watch out for:** the chat dispatches go to the session's default chat, so the waiter holds the chat channel, not the session channel.
  `setRead` and `setArchived` go to the session channel.

## Final verification checklist

- [ ] `npm run typecheck` and `npm test` pass.
- [ ] Against ahpd, `ahpc queue <uri> hi` prints an id, and `ahpc unqueue <uri> <id>` exits 0.
- [ ] Against ahpd, `ahpc unqueue <uri> no-such-id` prints the host's reason and exits 1.
- [ ] Against ahpd, `ahpc confirm <uri> no-such-call` prints the host's reason and exits 1.
- [ ] Against ahpd, `ahpc cancel <uri>` on an idle session prints one line and exits 1.
