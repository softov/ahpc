---
title: The chat screen steers a running turn, and shows the steering message
created: 2026-11-04
refs:
  - "[code://src/control.ts#L1050-L1063](../../src/control.ts#L1050-L1063) - a message sent while a turn runs is always queued"
  - "[code://src/ahp/live.ts#L1505-L1520](../../src/ahp/live.ts#L1505-L1520) - `queued` reads `queuedMessages`, and nothing reads `steeringMessage`"
  - "[code://src/ahp/live.ts#L3123-L3135](../../src/ahp/live.ts#L3123-L3135) - `steer`, which only `ahpc prompt --steer` calls"
  - "[code://src/cli/main.ts#L1067-L1129](../../src/cli/main.ts#L1067-L1129) - `session show` and `session history` print no queued or steering message"
  - npm://@microsoft/agent-host-protocol@^1.0.0 - `ChatState.steeringMessage`, one message the running turn takes at its next step
---

While a turn runs, the chat screen can only queue a message, because enter sends it behind the turn.
Only `ahpc prompt --steer` can steer, and no view draws the steering message that the host holds.
`session show` and `session history` print neither the queue nor the steering message, so an agent that drives ahpc from a shell cannot see them.
On 2026-11-04 another session reported this as "ahpc's chat view leaves out the queue and the steering slot".
The idea: a steer action in the composer, the steering message drawn in the history beside the queue, and both printed by `show` and `history`.
