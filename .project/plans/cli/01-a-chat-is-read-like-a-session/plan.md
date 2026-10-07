---
title: A chat is read like a session, and a refusal is printed as a sentence
domain: cli
status: built
priority: high
created: 2026-10-04
revalidated: 2026-10-04
requires: []
changes: []
creates: []
decisions: []
refs:
  - "[code://src/cli/main.ts#L1029-L1050](../../../../src/cli/main.ts#L1029-L1050) - `chats`: `list`, `new`, `rm`, and nothing that reads one"
  - "[code://src/cli/main.ts#L884-L909](../../../../src/cli/main.ts#L884-L909) - `session history`, which takes a session's snapshot"
  - "[code://src/cli/main.ts#L322](../../../../src/cli/main.ts#L322) - `snapshot`, typed to a `SessionUri`"
  - "[code://src/cli/main.ts#L780-L793](../../../../src/cli/main.ts#L780-L793) - only a `-32007` becomes a `Fault`; every other error is rethrown as it is"
  - "[code://src/cli/main.ts#L221](../../../../src/cli/main.ts#L221) - `Fault`, a message for the person"
---

## Goal

`ahpc chat show <chatUri>` and `ahpc chat history <chatUri>` read any chat, a subagent's included, the way `session show` and `session history` read a session, and a request the host refuses prints the host's sentence and code, not a stack.

## Reconnaissance

### Searches performed

- 2026-10-04 against ahpd: `ahpc session history ahp-chat://subagent/<session>/<call>` printed nothing for a chat holding one turn; `session show` on it answered `lifecycle: creating` with no chats. Reading it took a raw `initialize` with `initialSubscriptions: [chatUri]`.
- `ahpc session rm claude:/<unknown>` printed `RpcError: RPC error -32001: ...` and four `at AhpClient...` lines.

### Runtime path

```
chat show|history <chatUri> -> subscribe(chatUri) -> ChatState { title, status, origin, turns, activeTurn } -> render
any command -> RpcError -> Fault(`<message> (<code>)`) -> stderr, exit 1
```

### Gaps

- `chats` has no reading verb.
- A non-auth `RpcError` reaches the top level as itself.

## Decisions locked in

| Decision | Task |
| --- | --- |
| - none | - |

| What | Source | Task |
| --- | --- | --- |
| `chat show` and `chat history` take a chat URI and print what `session show` and `session history` print for a session, with `--json`, `--full` and `--all` meaning the same | Softov, 2026-10-04: "we need a subagent to update ahpc ... and fix those things you found now" | 01 |
| `chat show` also prints the chat's `origin`: for a subagent, the spawning chat and tool call | (defaulted: the one field a chat has that a session row does not) | 01 |
| Every `RpcError` is printed as `<message> (<code>)` and exits 1; `AHPC_DEBUG=1` keeps the stack | (defaulted: `Fault` already says a person gets a sentence; the variable keeps the stack for a bug report) | 02 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - chat show and chat history](task-01-chat-show-and-history.md) | done | - |
| [02 - A refusal is a sentence](task-02-a-refusal-is-a-sentence.md) | done | - |

## Risks and tradeoffs

- A host that answers a chat subscription with a session snapshot (an older ahpd) prints nothing; the command says the host sent no chat state.

## Resume state

- **Done so far:** tasks 01 and 02, on 2026-10-07. See [implemented.md](implemented.md).
- **Next action:** none.

## Final verification checklist

- [ ] Against ahpd: `ahpc chat history` on a subagent chat prints its turn; `chat show` prints its title and origin. `chat show` checked on a session chat on 2026-10-07; no subagent chat was open.
- [x] `ahpc session rm claude:/00000000-0000-0000-0000-000000000000` prints one line with `-32001`.
- [x] `npm test`, `npx tsc --noEmit` pass.
- [x] `plans/index.md` updated.
