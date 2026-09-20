---
title: Usage gets a screen of its own
status: accepted
date: 2026-09-19
refs:
  - code://src/ahp/live.ts#L1039-L1056 - where a turn's usage is read today, for the model id alone
  - code://src/screens.tsx - the screens the application already has
  - src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.ts#L637-L700 - the reference, which draws these numbers in the response footer, inside the clone
---

## Context

Per-turn token counts, the cost a turn billed, the model that was resolved when routing was automatic, and the model's context window are all reachable: the first three ride the usage report on a turn, and the fourth is declared on the model the host advertises.
The reference draws them in the response footer, which works in a window with a wide footer and a mouse.
This client reads usage for the model id alone, so all of it is dropped, not because it is unavailable but because nothing wanted it.

Asked on 2026-09-19 whether to draw it, the answer was: "Add a dedicated `/usage` screen."

## Decision

A `/usage` screen shows what a session has spent: per-turn tokens and cost for the chat that is open, the model each turn billed to including what automatic routing resolved to, and the context window against what the current turn has used.
It is a screen reached by a key like the others, and the header and history rows keep the width they have.

## Consequences

The numbers get room to be complete rather than abbreviated, and nothing already drawn has to change to make space.
It is a new screen with its own drawing, its own keys and its own tests, which is more than adding a field to a header, and the context window is only meaningful once the host advertises it, so that half depends on the model row carrying it.
The usage report is per turn and the context window is per model, so the screen has two sources and has to say which is which.

## Options

Drawing nothing was rejected by the answer above: it is the no-work option and it leaves reachable data unread.
Putting tokens and the context window in the history row was rejected: it is smaller, and a fixed-width terminal row is the one place these numbers cannot be shown without abbreviating them into ambiguity.
