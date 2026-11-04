---
title: An answered question shows its answers
created: 2026-11-04
refs:
  - npm://@microsoft/agent-host-protocol@^1.0.0 - `ToolCallResult.structuredContent`
  - file:///github/ahpd/.project/plans/claude/11-an-answered-question-carries-its-answers - ahpd puts an answered question's questions and answers in `structuredContent`
---

ahpd puts the questions and the answers of an answered question in the tool result's `structuredContent`.
ahpc reads `structuredContent` only in its own MCP server, so the history does not show what was answered.
The idea: draw the answers under the question's tool row, in the history and in `session history`.
