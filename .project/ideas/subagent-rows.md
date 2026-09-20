---
title: Subagent rows
created: 2026-09-19
---

A host marks the tool call that starts a subagent: `_meta.toolKind` is `subagent`, and `_meta.subagentDescription`, `_meta.subagentAgentName` and `_meta.subagentChatUri` name the child and point at its chat.
The reference window reads those four and `ToolResultSubagentContent` with them, and draws a subagent row that can open the child chat, while this client reads only `_meta.progressMessage` and draws every subagent call as an ordinary tool row.
Whether a subagent is alive is not a parent field either: the reference derives it from the child chat's own `activeTurn` and `turns` on a second channel, which is state this client already subscribes to whenever that chat is open.

What it would take here: the four keys read where a tool call is folded in `src/ahp/live.ts`, a block kind in `src/blocks.ts` that draws the child's name and its running state, and the child chat's channel opened when the row is drawn.
These reads are older than the pass that recorded them: `src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.ts` changed by nineteen lines in that range and none of them touch the subagent keys, so this is a gap of long standing rather than a change to port.
