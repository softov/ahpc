---
title: chat show and chat history read one chat
status: todo
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

