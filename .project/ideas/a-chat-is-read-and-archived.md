---
title: A chat is marked read or archived on its own
created: 2026-11-04
refs:
  - "[code://src/ahp/live.ts#L2827-L2829](../../src/ahp/live.ts#L2827-L2829) - only the session's read and archived bits are sent"
  - npm://@microsoft/agent-host-protocol@^1.0.0 - a chat's own read and archived bits in its `status`, with `chat/isReadChanged` and `chat/isArchivedChanged`
  - file:///github/ahpd/packages/sdk/src/sessions/nested.ts - at ahpd `586d4e5a`, ahpd handles the chat actions
---

Protocol 1.0.0 gives each chat its own read and archived bits.
ahpc has `session read` and `session archive`, and nothing for one chat of a session.
The idea: draw a chat's read and archived state, and mark one chat from the screen and the shell.
