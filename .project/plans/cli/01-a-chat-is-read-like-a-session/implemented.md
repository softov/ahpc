---
title: A chat is read like a session, and a refusal is printed as a sentence - implemented
date: 2026-10-07
refs:
  - git://32f177c
  - "[code://src/cli/main.ts](../../../../src/cli/main.ts) - `chat show`, `chat history` and the general refusal path"
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts) - `chat()` and `loadOlderChatTurns()`"
  - "[code://src/ahp/auth.ts](../../../../src/ahp/auth.ts) - `hostWords`, which strips the SDK's prefix"
---

`ahpc chat show` and `ahpc chat history` read one chat by its URI, the way `session show` and `session history` read a session.
A request the host refuses prints one line: the host's sentence and its code.

## What was built

- [`code://src/cli/main.ts`](../../../../src/cli/main.ts) - `show` and `history` in `chats`, and `printTurns()`, which `session history` and `chat history` share.
- [`code://src/ahp/live.ts`](../../../../src/ahp/live.ts) - `chat()` reads a chat state through one seam read, and `originOf()` reads the chat's origin.
- [`code://src/ahp/fake.ts`](../../../../src/ahp/fake.ts) - both methods, and a fork that copies the source chat's turns.
- [`code://src/cli/main.ts`](../../../../src/cli/main.ts) - every `RpcError` with a code becomes a `Fault` that reads `<host words> (<code>)`. The words go through `hostWords`, so the SDK's `RPC error <code>:` prefix is not printed. This part landed with cli/03.

## Verified

- `test/cli.test.ts` holds the chat cases and a case that throws the SDK's own `RpcError` and asserts `No agent for session ahp-session:/not-a-session (-32001)`.
- On 2026-10-07, against ahpd 0.10.0: `ahpc session rm claude:/00000000-0000-0000-0000-000000000000` printed `No agent for session claude:/00000000-0000-0000-0000-000000000000 (-32001)` and exited 1.
- On 2026-10-07, against ahpd 0.10.0: `ahpc chat show` on a build session's chat printed its title, status, `Origin  user` and its turn count.
- `npm run typecheck` and `npm run build` pass. `npm test`: 682 of 683 pass in the worktree. The one failure is `test/smoke.test.tsx:1625`, which reads the folder name.

## Departures from the plan

- The refusal first printed the SDK's prefix and the code twice. The fix was made in the cli/03 worktree.
- `AHPC_DEBUG=1` prints the stack only for an error that is not a `Fault`, which is this client going wrong. A refusal is a `Fault`, so it prints one line with or without the variable. Checked against ahpd on 2026-10-07.

## Left for later

- `chat history` on a subagent chat against a live host. No subagent chat was open on 2026-10-07.
- No CLI test reaches `originLine` for a chat with a parent, because `chat new` takes no source.
