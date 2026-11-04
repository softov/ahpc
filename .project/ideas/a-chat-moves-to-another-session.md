---
title: A chat moves to another session
created: 2026-11-04
refs:
  - "[code://src/ahp/live.ts#L216-L219](../../src/ahp/live.ts#L216-L219) - `moveChat` is named as not drawn"
  - npm://@microsoft/agent-host-protocol@^1.0.0 - `moveChat`, `session/chatsReordered` and `chat/movableChanged`
  - file:///github/ahpd/.project/plans/host/47-p1-moving-a-chat/plan.md - ahpd serves it, built
---

Protocol 1.0.0 can move a chat from one session to another, and says which chats can move.
ahpc does not send `moveChat`, and does not follow `session/chatsReordered` or `chat/movableChanged`.
The idea: a move action on a chat that can move, and the session's chat order kept from the host.
