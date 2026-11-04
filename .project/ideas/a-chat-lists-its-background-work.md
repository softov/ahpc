---
title: A chat lists the work it left running
created: 2026-11-04
refs:
  - npm://@microsoft/agent-host-protocol@^1.0.0 - `ChatState.backgroundWork`, with `chat/backgroundWorkSet` and `chat/backgroundWorkRemoved`
  - file:///github/ahpd/.project/plans/host/47-p2-a-chat-lists-its-background-work/plan.md - ahpd serves it, built
---

A chat can leave work running after its turn ends, such as a shell command in the background.
ahpd lists it in `backgroundWork`, and ahpc reads none of it.
The idea: draw the running work in the chat, and in the session's row while any runs.
