---
title: One accepted credential runs the refused act exactly once more
status: accepted
date: 2026-09-23
refs:
  - code://src/control.ts#L442-L446 - `failed`, where every rejected act lands today with nothing left to re-run
  - code://src/control.ts#L531-L546 - `refresh`, the shape of a controller method that forwards one awaited call
  - code://src/ahp/live.ts#L2124-L2155 - `listSessions`, which awaits and lets the refusal reject
  - code://src/ahp/live.ts#L1883-L1899 - `dispatch`, fire-and-forget, and the reason it is not covered
  - code://src/ahp/live.ts#L1956-L1982 - `authenticate` and `protectedResources`
  - file:///github/ahpapp/src/auth-gate.tsx#L223-L246 - `attempt`, the reference's one loop
  - file:///github/ahpapp/src/auth-required.ts#L239-L248 - `retryAllowed`, the rule itself
---

## Context

When an act is refused with `-32007`, this client reports the host's words and stops.
The act itself is gone by then: the promise has rejected, the controller's `failed` has written the sentence, and nothing holds what was asked for.
The reference client keeps the promise and re-runs the same act once a credential is accepted, and states the discipline as three rules: one attempt is one attempt, one accepted credential buys exactly one more attempt, and a second refusal is the host's answer rather than a second question.

## Decision

After `authenticate` is accepted, the refused act runs once more, automatically.
The count is per act: a credential the host refuses does not count as an attempt, and the act is not sent again until one is accepted.
A second `-32007` for the same act is reported and nothing else is sent.
Only an act this client can run as one awaited call is covered.
A fire-and-forget dispatch is not, because ahpc sends one without keeping a handle to match its echo, and re-sending a chat message or a keystroke on its own is worse than asking the person to do it again.

Source: (defaulted: the reference's three rules at `/github/ahpapp/src/auth-gate.tsx:15-24` and `refusalStep` at `/github/ahpapp/src/auth-required.ts:133-145`, and the plan's own words "retry the refused act exactly once".)

## Consequences

The person answers one question and the thing they asked for happens, which is the whole point of the prompt.
A controller method that forwards one call to the host gains the same five lines whether it is a catalogue read, a file listing or a session creation, so the discipline lives in one place rather than at each call site.
The wrapper goes around the single `await host.<call>()` at its call site and never around the method, because `refresh`, `createChat`, `disposeChat` and `disposeSession` catch their own rejection (`src/control.ts:545`, `:585`, `:591`, `:843`) and `create` acts again after its await (`:861-866`).
An act that has side effects before the refusal is re-run from its own start, which is why the wrapper is applied to single calls and not to a command with several.
A host that keeps refusing is a wall the client stops at, in the host's own words.

## Options

- **Have the person repeat the act themselves after signing in.** Rejected: the client is holding the refused promise and knows exactly what was asked for, so making them find the key or retype the message is information thrown away.
- **Retry in a loop until it works.** Rejected: a host that refuses twice has answered, and a loop turns a wall into a spinner.
- **Retry the credential itself.** Rejected: `authenticate` is not the refused act, and retrying a rejected token would ask the host the same question again.
- **Cover the fire-and-forget dispatches too.** Rejected for now: ahpc's dispatch handle does not surface the client sequence the host echoes, so there is nothing to match a refusal to its own action, and silently re-sending a chat message or terminal input is a second act nobody agreed to.
