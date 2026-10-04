---
title: What protocol 1.0.0 adds that ahpc does not draw
---

Once [ahp/05](../plans/ahp/05-protocol-1-0-0/plan.md) puts ahpc on 1.0.0, these arrive and nothing on the screen or in the shell shows them:

- A chat's own read and archived bits in its `status`, and `chat/isReadChanged`, `chat/isArchivedChanged`: the session already has `session read` and `session archive`; chats have no equivalent.
- `moveChat`, `session/chatsReordered`, `chat/movableChanged`: moving a chat to another session, which ahpd plans in host/47 p1.
- `ChatState.backgroundWork`, `chat/backgroundWorkSet|Removed`: work a chat left running.
- `session/mcpServerBackgroundRequested` and `McpServerStartingState.blocking`.
- `ChangesetStatus.recomputing`.
- `ToolCallResult.structuredContent`: ahpd puts an answered question's answers there (claude/11).

Source: ahpd's `UPSTREAM.md`, "The wire, beside the features".
