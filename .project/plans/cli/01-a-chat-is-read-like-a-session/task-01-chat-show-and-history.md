---
title: chat show and chat history read one chat
status: implemented
depends: []
layer: "cli"
refs:
  - "[code://src/cli/main.ts#L1029-L1050](../../../../src/cli/main.ts#L1029-L1050) - `chats`"
  - "[code://src/cli/main.ts#L884-L909](../../../../src/cli/main.ts#L884-L909) - `session history`'s printing, to reuse"
---

## Objective

`ahpc chat show <chatUri>` prints a chat's title, status, origin and turn count; `ahpc chat history <chatUri>` prints its turns as `session history` does.

## Files

- `UPDATE: src/cli/main.ts` - `show` and `history` verbs in `chats`; the turn printing shared with `session history`.
- `UPDATE: src/ahp/connection.ts`, `src/ahp/live.ts`, `src/ahp/fake.ts` - a way to subscribe to a chat channel and read its `ChatState`, if `HostConnection` has none.
- `UPDATE: src/cli/main.ts` help text, and `REFERENCE.md`.
- `UPDATE: test/cli.test.ts`.

## Steps

1. Read a chat's state by subscribing to its URI; `--all` pages older turns as `session history` does.
2. `show`: title, status, `origin` (kind, and for `tool` the chat and tool call), turn count; `--json` the state.
3. `history`: the shared turn printer; `--json`/`--full` the turns.
4. Help and `REFERENCE.md` list both verbs.

## Validation

- Against the fake host: a subagent chat with one turn prints that turn; `show --json` has the origin.
- By hand against ahpd: a subagent chat of a running session.

## Resume

A chat is readable on its own: `ahp-chat:/…` is a channel the host keeps without a session around it, and `channels.state()` subscribes, takes the state and unsubscribes. So the reading is one seam read rather than a subscription the CLI would have to hold.

**Files**

- `src/ahp/types.ts` - `ChatState` and `ChatOrigin`, taken from the package's own declarations rather than declared beside them. `ChatOrigin` is the four cases `fork`, `sideChat` and `tool` share a parent chat and a turn or tool call with, and `user`; it is `@nonexhaustive`, so it is read through a helper that returns `undefined` for a kind it does not know instead of switching exhaustively.
- `src/ahp/connection.ts` - `chat(uri)` and `loadOlderChatTurns(uri)` on the seam.
- `src/ahp/live.ts` - `chat()` folds a chat state the same way `session()` folds a session one, with `origin` left out where the host sent none; `loadOlderChatTurns` reuses the paging the session history already had. `originOf()` is the reader for the union.
- `src/ahp/fake.ts` - both methods, and a `sessionOfChat()` helper. That helper was not in the task and is here because a test found the gap: `createChat` read a fork source's turns out of a map keyed by *session* URI, so a fork copied none of them. A fake that answers a different thing than the real host is worse than one that throws.
- `src/cli/main.ts` - `show` and `history` in `chats`, two HELP lines, and `printTurns()` lifted out of `session history` and shared, so the two verbs cannot drift. A chat with no state at all raises `The host sent no chat state for that chat.`, which is what the plan's risk section asked for.
- `REFERENCE.md` - a paragraph in "The specification", since `chat show` prints the field the specification's chat page describes and the types come from the package.

**Tests** (`test/cli.test.ts`, 21 to 24)

The CLI tests drive `cli()` through a hermetic `run()` helper - a temporary `XDG_CONFIG_HOME` and `AHPC_HOST` removed - because without it the tests inherited this machine's own `~/.config/ahpc/config.json` and connected to a live host. Covered: `chat show` rows including the turn count; `chat show --json` with no `origin` key and no `Origin` row, which is the absent case the seam can produce; `chat history` printing a turn; `--json` and `--full` yielding the same three ids; `--all`; both verbs against a chat that does not exist, giving exactly the one sentence; `chat list` still taking a session URI; and an unknown verb.

The other three drive `fakeHost()` directly, because `chat new` never passes a source and `connect()` builds a fresh fake per invocation, so no chat reachable from the CLI carries an origin. They cover a forked chat reporting that fork and holding the source's two turns, the session's own chat read by its chat URI, an unknown chat answering `resource: ''` rather than throwing, and `loadOlderChatTurns` answering `false` for both a whole chat and an unknown one.

**Not covered:** `originLine` in the CLI, for the reason above. Reaching it needs either a source on `chat new` or a fake that seeds one; neither is in this task.

**Not done:** the task's second validation line is by hand against ahpd, which is not reachable from here.

`npm run typecheck` clean, `test/cli.test.ts` 24 passing, `npm test` 665 of 666 - the one failure is `test/smoke.test.tsx:1625`, which expects the bar to name `ahpc` and is given this worktree's directory name; it fails at baseline and nothing here touches it.

